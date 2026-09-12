union TrainingNodeKind {
  lesson: "lesson",
  scenario: "scenario",
  checkpoint: "checkpoint",
  outcome: "outcome",
}

model TrainingCheckpoint {
  id: string;
  label: string;
  required: boolean;
}

model TrainingChoice {
  id: string;
  label: string;
  summary?: string;
  nextNodeId: string;
  tags?: string[];
}

model TrainingOutcome {
  tierId?: string;
  message: string;
}

model TrainingNode {
  id: string;
  kind: TrainingNodeKind;
  title: string;
  prompt: string;
  learningObjectives: string[];
  checkpoints: TrainingCheckpoint[];
  choices: TrainingChoice[];
  outcome?: TrainingOutcome;
}

model TrainingGraph {
  schemaVersion: "1.0.0";
  graphId: "canonical-compliance-training-v1";
  title: string;
  summary: string;
  entryNodeId: string;
  nodes: TrainingNode[];
}
