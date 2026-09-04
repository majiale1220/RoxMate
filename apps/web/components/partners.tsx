import type { Connection } from "../lib/personal-types";
import { normalizeWallet } from "../lib/shared";

type PartnerRowProps = {
  connection: Connection;
  viewer: string;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onOpen: () => void;
};

export function PartnerRow({ connection, viewer, busy, onAccept, onDecline, onOpen }: PartnerRowProps) {
  const incoming = connection.status === "PENDING" && normalizeWallet(connection.recipient) === normalizeWallet(viewer);
  const description = connection.status === "ACCEPTED"
    ? "已成为搭档"
    : connection.status === "DECLINED"
      ? "邀请已拒绝"
      : incoming
        ? "邀请你成为搭档"
        : "等待对方接受";

  return <article className="panel partner-row">
    <div><h3>{connection.display_name}</h3><p className="helper">{connection.city} · {description}</p></div>
    <div className="card-actions">
      {incoming && <><button className="primary-button" disabled={busy} onClick={onAccept}>接受邀请</button><button className="secondary-button" disabled={busy} onClick={onDecline}>拒绝</button></>}
      {connection.status === "ACCEPTED" && <button className="secondary-button" disabled={busy} onClick={onOpen}>查看成绩与评价</button>}
    </div>
  </article>;
}
