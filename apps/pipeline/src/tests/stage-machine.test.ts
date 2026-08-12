import type { Test } from "./testHelpers";
import { assertTrue, assertEqual } from "./testHelpers";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_EDGES,
  IllegalStageTransitionError,
  isLegalPipelineTransition,
  isTerminalStage,
  assertLegalPipelineTransition,
} from "../lib/stage-machine";

export const stageMachineTests: Test[] = [
  {
    name: "stage-machine: every declared edge is legal",
    run: () => {
      for (const from of PIPELINE_STAGES) {
        for (const to of PIPELINE_STAGE_EDGES[from]) {
          assertTrue(isLegalPipelineTransition(from, to), `${from} -> ${to} should be legal (it's a declared edge)`);
        }
      }
    },
  },
  {
    name: "stage-machine: the full happy path is legal, stage by stage",
    run: () => {
      assertTrue(isLegalPipelineTransition("showing", "offer"), "showing -> offer");
      assertTrue(isLegalPipelineTransition("offer", "under_contract"), "offer -> under_contract");
      assertTrue(isLegalPipelineTransition("under_contract", "inspection"), "under_contract -> inspection");
      assertTrue(isLegalPipelineTransition("inspection", "closing"), "inspection -> closing");
      assertTrue(isLegalPipelineTransition("closing", "closed_won"), "closing -> closed_won");
    },
  },
  {
    name: "stage-machine: closed_lost is reachable from every non-terminal stage",
    run: () => {
      for (const from of PIPELINE_STAGES) {
        if (isTerminalStage(from)) continue;
        assertTrue(isLegalPipelineTransition(from, "closed_lost"), `${from} -> closed_lost should always be legal`);
      }
    },
  },
  {
    name: "stage-machine: no backward transitions are legal",
    run: () => {
      assertTrue(!isLegalPipelineTransition("offer", "showing"), "offer -> showing should be illegal (no backward edges)");
      assertTrue(!isLegalPipelineTransition("closing", "under_contract"), "closing -> under_contract should be illegal");
      assertTrue(!isLegalPipelineTransition("inspection", "offer"), "inspection -> offer should be illegal");
    },
  },
  {
    name: "stage-machine: no skipping stages forward",
    run: () => {
      assertTrue(!isLegalPipelineTransition("showing", "under_contract"), "showing -> under_contract should be illegal (skips offer)");
      assertTrue(!isLegalPipelineTransition("offer", "inspection"), "offer -> inspection should be illegal (skips under_contract)");
      assertTrue(!isLegalPipelineTransition("showing", "closing"), "showing -> closing should be illegal");
      assertTrue(!isLegalPipelineTransition("showing", "closed_won"), "showing -> closed_won should be illegal (no shortcut to won)");
    },
  },
  {
    name: "stage-machine: terminal stages have no legal outgoing transitions",
    run: () => {
      assertTrue(isTerminalStage("closed_won"), "closed_won is terminal");
      assertTrue(isTerminalStage("closed_lost"), "closed_lost is terminal");
      for (const to of PIPELINE_STAGES) {
        assertTrue(!isLegalPipelineTransition("closed_won", to), `closed_won -> ${to} should be illegal (terminal)`);
        assertTrue(!isLegalPipelineTransition("closed_lost", to), `closed_lost -> ${to} should be illegal (terminal)`);
      }
    },
  },
  {
    name: "stage-machine: non-terminal stages are not reported terminal",
    run: () => {
      for (const stage of PIPELINE_STAGES) {
        if (stage === "closed_won" || stage === "closed_lost") continue;
        assertTrue(!isTerminalStage(stage), `${stage} should not be terminal`);
      }
    },
  },
  {
    name: "stage-machine: assertLegalPipelineTransition throws IllegalStageTransitionError on an illegal transition",
    run: () => {
      let threw = false;
      try {
        assertLegalPipelineTransition("showing", "closed_won");
      } catch (e) {
        threw = true;
        assertTrue(e instanceof IllegalStageTransitionError, "expected an IllegalStageTransitionError instance");
        assertEqual((e as IllegalStageTransitionError).from, "showing", "error.from should be the source stage");
        assertEqual((e as IllegalStageTransitionError).to, "closed_won", "error.to should be the attempted target stage");
      }
      assertTrue(threw, "assertLegalPipelineTransition should have thrown");
    },
  },
  {
    name: "stage-machine: assertLegalPipelineTransition does not throw on a legal transition",
    run: () => {
      assertLegalPipelineTransition("under_contract", "inspection");
    },
  },
];
