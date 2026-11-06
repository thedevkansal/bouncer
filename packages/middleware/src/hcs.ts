// Hedera Consensus Service: tamper-evident audit log of every settled agent payment.
// One message per settlement; read back from the Mirror Node for the dashboard.
import { AccountId, Client, PrivateKey, TopicId, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";

export interface AuditEntry {
  v: 1;
  agent: string;
  humanHash: string | null; // salted hash prefix only
  verified: boolean;
  path: string;
  amount: string;
  asset: string;
  priceUsd: number;
  tx: string;
  ts: string;
  stepUp?: string;
}

export interface HcsConfig {
  operatorId: string;
  operatorKey: string; // hex ECDSA
  topicId: string;
  mirrorUrl: string;
}

export function createHcsAudit(cfg: HcsConfig) {
  const key = PrivateKey.fromStringECDSA(cfg.operatorKey);
  const client = Client.forTestnet().setOperator(AccountId.fromString(cfg.operatorId), key);
  const topic = TopicId.fromString(cfg.topicId);

  return {
    topicId: cfg.topicId,
    async submit(entry: AuditEntry): Promise<{ sequence: string; txId: string }> {
      const tx = await new TopicMessageSubmitTransaction().setTopicId(topic).setMessage(JSON.stringify(entry)).execute(client);
      const receipt = await tx.getReceipt(client);
      return { sequence: receipt.topicSequenceNumber?.toString() ?? "", txId: tx.transactionId.toString() };
    },
    /** Latest audit messages from the Mirror Node (newest first). */
    async recent(limit = 25) {
      const r = await fetch(`${cfg.mirrorUrl}/api/v1/topics/${cfg.topicId}/messages?order=desc&limit=${limit}`);
      if (!r.ok) return [];
      const j = (await r.json()) as { messages: { sequence_number: number; consensus_timestamp: string; message: string }[] };
      return j.messages.map((m) => {
        let body: unknown = null;
        try {
          body = JSON.parse(Buffer.from(m.message, "base64").toString("utf8"));
        } catch {
          body = Buffer.from(m.message, "base64").toString("utf8");
        }
        return { sequence: m.sequence_number, consensusTimestamp: m.consensus_timestamp, entry: body };
      });
    },
  };
}

export type HcsAudit = ReturnType<typeof createHcsAudit>;
