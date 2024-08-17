from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from repeng import ControlModel, ControlVector
import pickle
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_name = "mistralai/Mistral-7B-Instruct-v0.1"
tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token_id = 0

model = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype=torch.float16)
device = "cuda:0" if torch.cuda.is_available() else "mps:0" if torch.backends.mps.is_available() else "cpu"
print(f"Using device: {device}")

model = model.to(device)
model = ControlModel(model, list(range(-5, -18, -1)))

with open("control_vectors.pkl", "rb") as f:
    control_vectors = pickle.load(f)

desired_axes = ["axis_0", "axis_1", "axis_2"]  # happy-sad, angry-calm, disgusted-interested
control_vectors = {k: v for k, v in control_vectors.items() if k in desired_axes}

class GenerationRequest(BaseModel):
    prompt: str
    weights: List[float]

def apply_control_vectors(model, control_vectors, weights):
    combined_vector = None
    for cv, w in zip(control_vectors.values(), weights):
        if combined_vector is None:
            combined_vector = cv * w
        else:
            combined_vector += cv * w
    model.set_control(combined_vector)

def generate_text(prompt: str, weights: List[float]):
    model.reset()
    apply_control_vectors(model, control_vectors, weights)

    input_ids = tokenizer(prompt, return_tensors="pt").to(model.device)
    settings = {
        "pad_token_id": tokenizer.eos_token_id,
        "do_sample": False,
        "max_new_tokens": 128,
        "repetition_penalty": 1.2,
    }

    output = model.generate(**input_ids, **settings)
    decoded_output = tokenizer.decode(output[0], skip_special_tokens=True)

    response = decoded_output.split("[/INST]")[-1].strip()
    return response
                
class WeightDict(BaseModel):
    happy_sad: float
    angry_calm: float
    disgusted_interested: float

class GenerationRequest(BaseModel):
    prompt: str
    weights: WeightDict
    persona: str = "you are roleplaying as Gizmo, a living digital cute sphere."
    rules: str = "IMPORTANT: use maximum 30 words. use lowercase. be concise and emotive."
    task: str = "you are Gizmo. answer the following message from your interlocutor:"

@app.post("/generate")
async def generate(request: GenerationRequest):
    user_tag, asst_tag = "[INST]", "[/INST]"
    full_prompt = f"{user_tag} {request.persona} {request.rules} {request.task} {request.prompt} {asst_tag}"

    weights = [request.weights.happy_sad, request.weights.angry_calm, request.weights.disgusted_interested]
    return StreamingResponse(generate_text(full_prompt, weights), media_type="text/plain")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
