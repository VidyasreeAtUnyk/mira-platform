import type { Test } from "./testHelpers";
import { assertTrue, assertEqual, assertThrows, createTestDb, seedMinimalAgent, seedMinimalLead, seedMinimalProperty } from "./testHelpers";
import { createTransaction, transitionTransaction, getTransactionHistory } from "../lib/transactions";
import { IllegalStageTransitionError } from "../lib/stage-machine";

export const transactionsTests: Test[] = [
  {
    name: "createTransaction: creates a transaction at the entry stage 'showing' with a history row",
    run: async () => {
      const db = await createTestDb();
      const leadId = await seedMinimalLead(db);
      const propertyId = await seedMinimalProperty(db);
      const txn = await createTransaction(db, { lead_id: leadId, property_id: propertyId });
      assertEqual(txn.stage, "showing", "a freshly created transaction should start at 'showing'");
      const history = await getTransactionHistory(db, txn.id);
      assertEqual(history.length, 1, "creating a transaction should write exactly one history row");
      assertEqual(history[0].from_stage, null, "the creation history row should have a null from_stage");
      assertEqual(history[0].to_stage, "showing", "the creation history row should target 'showing'");
    },
  },
  {
    name: "transitionTransaction: a legal transition (showing -> offer) updates stage and appends history",
    run: async () => {
      const db = await createTestDb();
      const leadId = await seedMinimalLead(db);
      const txn = await createTransaction(db, { lead_id: leadId });
      const updated = await transitionTransaction(db, txn.id, { to_stage: "offer", offer_price: 500000 });
      assertEqual(updated.stage, "offer", "stage should be updated to 'offer'");
      assertEqual(updated.offer_price, 500000, "offer_price should be persisted");
      const history = await getTransactionHistory(db, txn.id);
      assertEqual(history.length, 2, "one creation row + one transition row");
      assertEqual(history[1].from_stage, "showing", "the transition row should record the prior stage");
      assertEqual(history[1].to_stage, "offer", "the transition row should record the new stage");
    },
  },
  {
    name: "transitionTransaction: an illegal transition (showing -> closed_won) is rejected and leaves state unchanged",
    run: async () => {
      const db = await createTestDb();
      const leadId = await seedMinimalLead(db);
      const txn = await createTransaction(db, { lead_id: leadId });
      await assertThrows(
        () => transitionTransaction(db, txn.id, { to_stage: "closed_won" }),
        "showing -> closed_won should be rejected",
      );
      const history = await getTransactionHistory(db, txn.id);
      assertEqual(history.length, 1, "a rejected transition must not append a history row");
    },
  },
  {
    name: "transitionTransaction: an illegal transition throws IllegalStageTransitionError specifically",
    run: async () => {
      const db = await createTestDb();
      const leadId = await seedMinimalLead(db);
      const txn = await createTransaction(db, { lead_id: leadId });
      try {
        await transitionTransaction(db, txn.id, { to_stage: "inspection" });
        assertTrue(false, "expected transitionTransaction to throw");
      } catch (e) {
        assertTrue(e instanceof IllegalStageTransitionError, "expected an IllegalStageTransitionError instance, not a generic Error");
      }
    },
  },
  {
    name: "transitionTransaction: skipping a stage forward (offer -> inspection) is rejected",
    run: async () => {
      const db = await createTestDb();
      const leadId = await seedMinimalLead(db);
      const txn = await createTransaction(db, { lead_id: leadId });
      await transitionTransaction(db, txn.id, { to_stage: "offer" });
      await assertThrows(
        () => transitionTransaction(db, txn.id, { to_stage: "inspection" }),
        "offer -> inspection should be rejected (skips under_contract)",
      );
    },
  },
  {
    name: "transitionTransaction: a transaction already in a terminal stage rejects any further transition",
    run: async () => {
      const db = await createTestDb();
      const leadId = await seedMinimalLead(db);
      const txn = await createTransaction(db, { lead_id: leadId });
      await transitionTransaction(db, txn.id, { to_stage: "closed_lost", lost_reason: "Buyer walked away" });
      await assertThrows(
        () => transitionTransaction(db, txn.id, { to_stage: "offer" }),
        "no transition should be legal once a transaction is closed_lost",
      );
    },
  },
  {
    name: "transitionTransaction: transitioning to closed_lost without a lost_reason is rejected",
    run: async () => {
      const db = await createTestDb();
      const leadId = await seedMinimalLead(db);
      const txn = await createTransaction(db, { lead_id: leadId });
      await assertThrows(
        () => transitionTransaction(db, txn.id, { to_stage: "closed_lost" }),
        "closed_lost without lost_reason should be rejected",
      );
    },
  },
  {
    name: "transitionTransaction: transitioning to closed_lost with a lost_reason sets closed_at",
    run: async () => {
      const db = await createTestDb();
      const leadId = await seedMinimalLead(db);
      const txn = await createTransaction(db, { lead_id: leadId });
      const updated = await transitionTransaction(db, txn.id, { to_stage: "closed_lost", lost_reason: "No financing" });
      assertEqual(updated.stage, "closed_lost", "stage should be closed_lost");
      assertTrue(updated.closed_at !== null, "closed_at should be set on a terminal transition");
      assertEqual(updated.lost_reason, "No financing", "lost_reason should be persisted");
    },
  },
  {
    name: "transitionTransaction: the full happy path reaches closed_won and sets closed_at",
    run: async () => {
      const db = await createTestDb();
      const agentId = await seedMinimalAgent(db);
      const leadId = await seedMinimalLead(db);
      const propertyId = await seedMinimalProperty(db);
      const txn = await createTransaction(db, { lead_id: leadId, property_id: propertyId, agent_id: agentId });
      await transitionTransaction(db, txn.id, { to_stage: "offer", changed_by: agentId, offer_price: 1000000 });
      await transitionTransaction(db, txn.id, { to_stage: "under_contract", changed_by: agentId, contract_price: 1010000 });
      await transitionTransaction(db, txn.id, { to_stage: "inspection", changed_by: agentId });
      await transitionTransaction(db, txn.id, { to_stage: "closing", changed_by: agentId });
      const final = await transitionTransaction(db, txn.id, { to_stage: "closed_won", changed_by: agentId });
      assertEqual(final.stage, "closed_won", "final stage should be closed_won");
      assertTrue(final.closed_at !== null, "closed_at should be set");
      const history = await getTransactionHistory(db, txn.id);
      assertEqual(history.length, 6, "creation + 5 transitions = 6 history rows");
    },
  },
];
