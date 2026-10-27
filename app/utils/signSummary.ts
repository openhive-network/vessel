/**
 * Phase 3 · Task 5 — plain-language rendering of the operations in a `vessel://sign` request, so the
 * confirm-and-sign modal shows a human exactly what they are about to sign. Pure (no DOM), unit-tested.
 */
export type SignOp = [string, Record<string, any>];

const at = (name: unknown): string => (name ? `@${String(name)}` : '(unknown)');

/**
 * A one-line, human-readable description of a single operation for the confirmation. Falls back to the
 * raw op name for types without bespoke phrasing — never throws, always returns a string.
 */
export function describeOp(op: SignOp): string {
  if (!Array.isArray(op) || typeof op[0] !== 'string') return 'Unrecognized operation';
  const [name, p = {}] = op;
  switch (name) {
    case 'transfer':
      return `Transfer ${p.amount} from ${at(p.from)} to ${at(p.to)}${p.memo ? ` — memo: "${p.memo}"` : ''}`;
    case 'transfer_to_savings':
      return `Move ${p.amount} from ${at(p.from)} to ${at(p.to)}'s savings`;
    case 'transfer_from_savings':
      return `Withdraw ${p.amount} from ${at(p.from)}'s savings to ${at(p.to)}`;
    case 'transfer_to_vesting':
      return `Power up ${p.amount} from ${at(p.from)} to ${at(p.to)}`;
    case 'withdraw_vesting':
      return `Power down ${p.vesting_shares} from ${at(p.account)}`;
    case 'delegate_vesting_shares':
      return `Delegate ${p.vesting_shares} from ${at(p.delegator)} to ${at(p.delegatee)}`;
    case 'set_withdraw_vesting_route':
      return `Route ${p.percent ? `${p.percent / 100}%` : 'part'} of ${at(p.from_account)}'s power-down to ${at(p.to_account)}`;
    case 'account_witness_vote':
      return `${p.approve ? 'Vote for' : 'Unvote'} witness ${at(p.witness)} as ${at(p.account)}`;
    case 'account_witness_proxy':
      return p.proxy
        ? `Set ${at(p.account)}'s witness proxy to ${at(p.proxy)}`
        : `Clear ${at(p.account)}'s witness proxy`;
    case 'vote':
      return `${p.weight < 0 ? 'Downvote' : 'Vote'} on @${p.author}/${p.permlink} as ${at(p.voter)}`;
    case 'custom_json':
      return `Custom JSON "${p.id}" as ${at(
        (Array.isArray(p.required_auths) && p.required_auths[0]) ||
          (Array.isArray(p.required_posting_auths) && p.required_posting_auths[0])
      )}`;
    case 'convert':
    case 'collateralized_convert':
      return `Convert ${p.amount} for ${at(p.owner)}`;
    case 'claim_reward_balance':
      return `Claim rewards for ${at(p.account)}`;
    case 'account_update':
    case 'account_update2':
      return `Update account authorities/keys for ${at(p.account)}`;
    default:
      return `Operation: ${name}`;
  }
}
