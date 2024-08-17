const svgFiles = import.meta.glob("./faces/*.svg", { as: "raw", eager: true });
const angrySVG = svgFiles["./faces/angry.svg"] as string;
const calmSVG = svgFiles["./faces/calm.svg"] as string;
const disgustSVG = svgFiles["./faces/disgust.svg"] as string;
const happySVG = svgFiles["./faces/happy.svg"] as string;
const sadSVG = svgFiles["./faces/sad.svg"] as string;
const interestSVG = svgFiles["./faces/interest.svg"] as string;
const thinkingSVG = svgFiles["./faces/thinking.svg"] as string;
const speaking1SVG = svgFiles["./faces/speaking1.svg"] as string;
const speaking2SVG = svgFiles["./faces/speaking2.svg"] as string;

export function interpolateFace(
  x: number,
  y: number,
  z: number,
  thinkingWeight: number,
  speakingWeight: number
): string {
  const normalizedCalmToAngry = (x + 1) / 2; // x from -1 (calm) to 1 (angry)
  const normalizedSadToHappy = (y + 1) / 2; // y from -1 (sad) to 1 (happy)
  const normalizedDisgustToInterest = (z + 1) / 2; // z from -1 (disgust) to 1 (interest)

  const happyWeight = 0;
  const sadWeight = Math.max(0, Math.pow(1 - normalizedSadToHappy, 2));
  const angryWeight = Math.max(0, Math.pow(normalizedCalmToAngry, 3));
  const calmWeight = Math.max(0, Math.pow(1 - normalizedCalmToAngry, 8));
  const disgustWeight = Math.max(0, Math.pow(normalizedDisgustToInterest, 3));
  const interestWeight = Math.max(0, Math.pow(1 - normalizedDisgustToInterest, 3));
  const maxThinkingWeight = 0.7;
  const currentThinkingWeight = thinkingWeight * maxThinkingWeight;

  const parser = new DOMParser();
  const happyDoc = parser.parseFromString(happySVG, "image/svg+xml");
  const sadDoc = parser.parseFromString(sadSVG, "image/svg+xml");
  const angryDoc = parser.parseFromString(angrySVG, "image/svg+xml");
  const calmDoc = parser.parseFromString(calmSVG, "image/svg+xml");
  const disgustDoc = parser.parseFromString(disgustSVG, "image/svg+xml");
  const interestDoc = parser.parseFromString(interestSVG, "image/svg+xml");
  const thinkingDoc = parser.parseFromString(thinkingSVG, "image/svg+xml");
  const speaking1Doc = parser.parseFromString(speaking1SVG, "image/svg+xml");
  const speaking2Doc = parser.parseFromString(speaking2SVG, "image/svg+xml");

  const elements = happyDoc.querySelectorAll("[id]");

  elements.forEach((element) => {
    const id = element.getAttribute("id");
    if (id === null) return;
    const sadElement = sadDoc.getElementById(id);
    const angryElement = angryDoc.getElementById(id);
    const calmElement = calmDoc.getElementById(id);
    const disgustElement = disgustDoc.getElementById(id);
    const interestElement = interestDoc.getElementById(id);
    const thinkingElement = thinkingDoc.getElementById(id);
    const speaking1Element = speaking1Doc.getElementById(id);
    const speaking2Element = speaking2Doc.getElementById(id);

    if (
      sadElement &&
      angryElement &&
      calmElement &&
      disgustElement &&
      interestElement &&
      thinkingElement &&
      speaking1Element &&
      speaking2Element &&
      element.tagName === sadElement.tagName
    ) {
      if (element.tagName === "path") {
        const happyPath = element.getAttribute("d");
        const sadPath = sadElement.getAttribute("d");
        const angryPath = angryElement.getAttribute("d");
        const calmPath = calmElement.getAttribute("d");
        const disgustPath = disgustElement.getAttribute("d");
        const interestPath = interestElement.getAttribute("d");
        const thinkingPath = thinkingElement.getAttribute("d");

        if (happyPath && sadPath && angryPath && calmPath && disgustPath && interestPath && thinkingPath) {
          const happySadPath = interpolatePath(happyPath, sadPath, sadWeight);
          const angryBlendPath = interpolatePath(happySadPath, angryPath, angryWeight);
          const happyBlendPath = interpolatePath(angryBlendPath, happyPath, happyWeight);
          const calmBlendPath = interpolatePath(happyBlendPath, calmPath, calmWeight);
          const disgustBlendPath = interpolatePath(calmBlendPath, disgustPath, disgustWeight);
          const interestBlendPath = interpolatePath(disgustBlendPath, interestPath, interestWeight);
          const thinkingBlendPath = interpolatePath(interestBlendPath, thinkingPath, currentThinkingWeight);

          let finalPath = thinkingBlendPath;

          if (id === "Mouth" && speakingWeight > 0) {
            const speaking1Path = speaking1Element.getAttribute("d");
            const speaking2Path = speaking2Element.getAttribute("d");
            if (speaking1Path && speaking2Path) {
              const interpolatedSpeakingPath = interpolatePath(speaking1Path, speaking2Path, speakingWeight - 1);
              finalPath = interpolatePath(finalPath, interpolatedSpeakingPath, Math.min(speakingWeight, 1) * 0.85);
            }
          }

          element.setAttribute("d", finalPath);
        }
      } else {
        ["cx", "cy", "r", "x", "y", "width", "height"].forEach((attr) => {
          const happyValue = parseFloat(element.getAttribute(attr) || "0");
          const sadValue = parseFloat(sadElement.getAttribute(attr) || "0");
          const angryValue = parseFloat(angryElement.getAttribute(attr) || "0");
          const calmValue = parseFloat(calmElement.getAttribute(attr) || "0");
          const disgustValue = parseFloat(disgustElement.getAttribute(attr) || "0");
          const interestValue = parseFloat(interestElement.getAttribute(attr) || "0");
          const thinkingValue = parseFloat(thinkingElement.getAttribute(attr) || "0");

          const happySadValue = happyValue + (sadValue - happyValue) * sadWeight;
          const angryBlendValue = happySadValue + (angryValue - happySadValue) * angryWeight;
          const happyBlendValue = angryBlendValue + (happyValue - angryBlendValue) * happyWeight;
          const calmBlendValue = happyBlendValue + (calmValue - happyBlendValue) * calmWeight;
          const disgustBlendValue = calmBlendValue + (disgustValue - calmBlendValue) * disgustWeight;
          const interestBlendValue = disgustBlendValue + (interestValue - disgustBlendValue) * interestWeight;
          const thinkingBlendValue = interestBlendValue + (thinkingValue - interestBlendValue) * currentThinkingWeight;

          let finalValue = thinkingBlendValue;

          if (id === "Mouth" && speakingWeight > 0) {
            const speaking1Value = parseFloat(speaking1Element.getAttribute(attr) || "0");
            const speaking2Value = parseFloat(speaking2Element.getAttribute(attr) || "0");
            const interpolatedSpeakingValue = speaking1Value + (speaking2Value - speaking1Value) * (speakingWeight - 1);
            finalValue = finalValue + (interpolatedSpeakingValue - finalValue) * Math.min(speakingWeight, 1) * 0.85;
          }

          element.setAttribute(attr, finalValue.toString());
        });
      }
    }
  });

  return new XMLSerializer().serializeToString(happyDoc);
}

function interpolatePath(path1: string, path2: string, t: number): string {
  const commands1 = parsePath(path1);
  const commands2 = parsePath(path2);

  const maxCommands = Math.max(commands1.length, commands2.length);
  while (commands1.length < maxCommands) commands1.push({ ...commands1[commands1.length - 1] });
  while (commands2.length < maxCommands) commands2.push({ ...commands2[commands2.length - 1] });

  const interpolatedCommands = commands1.map((cmd1, i) => {
    const cmd2 = commands2[i];
    const interpolatedParams = cmd1.params.map((param, j) => {
      const param2 = cmd2.params[j] || param;
      return param + (param2 - param) * t;
    });

    return { type: cmd1.type, params: interpolatedParams };
  });

  return interpolatedCommands.map((cmd) => `${cmd.type}${cmd.params.join(" ")}`).join(" ");
}

function parsePath(path: string): Array<{ type: string; params: number[] }> {
  const commands: Array<{ type: string; params: number[] }> = [];
  const regex = /([MLHVCSQTA])([^MLHVCSQTA]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    const type = match[1];
    const params = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(parseFloat);
    commands.push({ type, params });
  }
  return commands;
}
