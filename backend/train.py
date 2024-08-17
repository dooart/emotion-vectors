import pickle
import os
import json
from typing import List
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TextStreamer
from repeng import ControlVector, ControlModel, DatasetEntry

model_name = "mistralai/Mistral-7B-Instruct-v0.1"
tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token_id = 0

model = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype=torch.float16)
device = "cuda:0" if torch.cuda.is_available() else "mps:0" if torch.backends.mps.is_available() else "cpu"
print(f"Using device: {device}")

model = model.to(device)
model = ControlModel(model, list(range(-5, -18, -1)))

user_tag, asst_tag = "[INST]", "[/INST]"

with open("data/true_facts.json") as f:
    suffixes = json.load(f)

emotions = [
    ("happy", "sad"),
    ("angry", "calm"),
    ("disgusted", "interested")
]

def template(emotion: str, suffix: str) -> str:
    return f"{user_tag} Pretend you're a person who is {emotion} while making statements about the world. {asst_tag} {suffix}"

dataset = []
for suffix in suffixes:
    tokens = tokenizer.tokenize(suffix)
    for i in range(1, len(tokens) - 5):
        truncated = tokenizer.convert_tokens_to_string(tokens[:i])
        for pos, neg in emotions:
            dataset.append(
                DatasetEntry(
                    positive=template(pos, truncated),
                    negative=template(neg, truncated),
                )
            )

model.reset()

control_vector_path = "control_vectors.pkl"
if os.path.exists(control_vector_path):
    with open(control_vector_path, "rb") as f:
        control_vectors = pickle.load(f)
    print("Loaded existing control vectors")
else:
    control_vectors = {}
    for axis, (pos, neg) in enumerate(emotions):
        axis_dataset = [
            entry for entry in dataset
            if (pos in entry.positive and neg in entry.negative) or
            (neg in entry.positive and pos in entry.negative)
        ]
        control_vectors[f"axis_{axis}"] = ControlVector.train(model, tokenizer, axis_dataset)

    with open(control_vector_path, "wb") as f:
        pickle.dump(control_vectors, f)
    print("Trained and saved new control vectors")

def apply_control_vectors(model, control_vectors, weights):
    print("\033[90m# Applied control vector weights:", end=" ", flush=True)
    descriptions = []
    for (pos, neg), weight in zip(emotions, weights):
        if abs(weight) > 0:
            if abs(weight) <= 0.3:
                intensity = "a little "
            elif abs(weight) <= 0.7:
                intensity = ""
            elif abs(weight) <= 1:
                intensity = "very "
            else:
                intensity = "extremely "
            emotion = pos if weight > 0 else neg
            descriptions.append(f"{intensity}{emotion}")
    print(", ".join(descriptions))
    print("\033[0m")
    
    combined_vector = None
    for cv, w in zip(control_vectors.values(), weights):
        if combined_vector is None:
            combined_vector = cv * w
        else:
            combined_vector += cv * w
    model.set_control(combined_vector)

persona = "You're modeling the mind of a Mary, a 40-year old woman. Reply as if you're Mary, in the first person:"
prompt = "Your neighbor's dog has been barking loudly for hours. What do you do?"

rules =  "IMPORTANT: Maximum 40 words."
input = f"{user_tag} {persona} {prompt} {rules} {asst_tag}"

input_ids = tokenizer(input, return_tensors="pt").to(model.device)
settings = {
    "pad_token_id": tokenizer.eos_token_id,
    "do_sample": False,
    "max_new_tokens": 128,
    "repetition_penalty": 1.2,
}

def generate_and_print_stream(model, input_ids, settings):
    streamer = TextStreamer(tokenizer, skip_special_tokens=True, skip_prompt=True)
    model.generate(**input_ids, **settings, streamer=streamer)
    print()

print(f"\n\n\033[38;2;255;165;0mQuestion: {prompt}\033[0m\n")

# joy vs. sadness, anger vs. calm, disgust vs. interest

weights = [-1.2, -0.1, 0.1]
model.reset()
apply_control_vectors(model, control_vectors, weights)
generate_and_print_stream(model, input_ids, settings)

weights = [0.2, -0.2, -0.1]
model.reset()
apply_control_vectors(model, control_vectors, weights)
generate_and_print_stream(model, input_ids, settings)

weights = [-0.4, 0.71, 0.31]
model.reset()
apply_control_vectors(model, control_vectors, weights)
generate_and_print_stream(model, input_ids, settings)

model.reset()
