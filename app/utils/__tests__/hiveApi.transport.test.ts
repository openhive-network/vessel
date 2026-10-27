/**
 * Phase 4 T5 — facade transport tests. Mocks hive-tx's callRPC (the network) while keeping its crypto
 * real, and asserts the parts the crypto parity suite doesn't cover: every read maps to the right
 * condenser_api method + params, prepareTransaction builds the tapos exactly like hive-js, and the
 * broadcast error adapter reshapes hive-tx's RPCError into the shape processing.js:setError reads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock only the transport; PrivateKey/Transaction/Memo/config stay real.
vi.mock('hive-tx', async (importActual) => {
  const actual = await importActual<typeof import('hive-tx')>();
  return { ...actual, callRPC: vi.fn() };
});

import { callRPC } from 'hive-tx';
import { hiveApi, hiveTx } from '../hiveApi';

const mockCallRPC = callRPC as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockCallRPC.mockReset();
  mockCallRPC.mockResolvedValue(null);
});

describe('T5 reads — each maps to the right condenser_api method + params', () => {
  const cases: Array<[string, () => Promise<unknown>, string, unknown[]]> = [
    ['getDynamicGlobalProperties', () => hiveApi.getDynamicGlobalProperties(), 'condenser_api.get_dynamic_global_properties', []],
    ['getAccounts', () => hiveApi.getAccounts(['alice', 'bob']), 'condenser_api.get_accounts', [['alice', 'bob']]],
    ['getVestingDelegations', () => hiveApi.getVestingDelegations('alice', -1, 100), 'condenser_api.get_vesting_delegations', ['alice', -1, 100]],
    ['getWithdrawRoutes', () => hiveApi.getWithdrawRoutes('alice', 'outgoing'), 'condenser_api.get_withdraw_routes', ['alice', 'outgoing']],
    ['getSavingsWithdrawFrom', () => hiveApi.getSavingsWithdrawFrom('alice'), 'condenser_api.get_savings_withdraw_from', ['alice']],
    ['getAccountHistory', () => hiveApi.getAccountHistory('alice', 5, 10), 'condenser_api.get_account_history', ['alice', 5, 10]],
    ['getWitnessesByVote', () => hiveApi.getWitnessesByVote('', 100), 'condenser_api.get_witnesses_by_vote', ['', 100]],
    ['getConfig', () => hiveApi.getConfig(), 'condenser_api.get_config', []],
    ['getConversionRequests', () => hiveApi.getConversionRequests('alice'), 'condenser_api.get_conversion_requests', ['alice']],
  ];

  it.each(cases)('%s', async (_label, call, method, params) => {
    await call();
    expect(mockCallRPC).toHaveBeenCalledWith(method, params);
  });

  it('returns callRPC\'s result verbatim', async () => {
    const accounts = [{ name: 'alice' }];
    mockCallRPC.mockResolvedValueOnce(accounts);
    await expect(hiveApi.getAccounts(['alice'])).resolves.toBe(accounts);
  });
});

describe('T5 prepareTransaction — tapos matches hive-js _prepareTransaction', () => {
  it('LIB block - 1, prefix from the block previous id, +600s expiration', async () => {
    const previous = `00000fa012345678${'0'.repeat(24)}`; // bytes 4..7 = 12 34 56 78
    mockCallRPC.mockImplementation(async (method: string) => {
      if (method === 'condenser_api.get_dynamic_global_properties') {
        return { time: '2025-01-01T00:00:00', last_irreversible_block_num: 1000 };
      }
      if (method === 'condenser_api.get_block_header') return { previous };
      return null;
    });

    const prepared = await hiveTx.prepareTransaction({ operations: [['x', {}]], extensions: [] });

    expect(prepared.ref_block_num).toBe((1000 - 1) & 0xffff); // 999
    // ref_block_prefix = readUInt32LE at byte offset 4 -> 0x78563412
    expect(prepared.ref_block_prefix).toBe(0x78563412);
    // chain time + 600s, ISO without milliseconds
    expect(prepared.expiration).toBe(
      new Date(new Date('2025-01-01T00:00:00Z').getTime() + 600 * 1000).toISOString().slice(0, -5)
    );
    expect(prepared.operations).toEqual([['x', {}]]);
    // it asked for the LIB block header
    expect(mockCallRPC).toHaveBeenCalledWith('condenser_api.get_block_header', [1000]);
  });
});

describe('T5 broadcast — success + the RPCError -> processing.js error adapter (F6)', () => {
  it('broadcasts via condenser_api.broadcast_transaction and returns the result', async () => {
    mockCallRPC.mockResolvedValueOnce({ id: 'trx123' });
    const signed = { ref_block_num: 1, operations: [], signatures: ['ab'] };
    await expect(hiveTx.broadcastTransaction(signed)).resolves.toEqual({ id: 'trx123' });
    expect(mockCallRPC).toHaveBeenCalledWith('condenser_api.broadcast_transaction', [signed]);
  });

  it('reshapes a hive-tx RPCError so err.error.data.stack survives for setError', async () => {
    const stack = [{ format: 'missing authority ${a}', data: { a: 'active' } }];
    const rpcError: any = new Error('Assert Exception');
    rpcError.name = 'RPCError';
    rpcError.code = -32000;
    rpcError.data = { code: 10, name: 'assert_exception', stack };
    mockCallRPC.mockRejectedValueOnce(rpcError);

    await expect(hiveTx.broadcastTransaction({})).rejects.toMatchObject({
      error: { data: { stack } },
    });
  });

  it('passes through a non-RPC error unchanged', async () => {
    const netErr = new Error('network down');
    mockCallRPC.mockRejectedValueOnce(netErr);
    await expect(hiveTx.broadcastTransaction({})).rejects.toBe(netErr);
  });
});
