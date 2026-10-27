export const PROCESSING_ACCOUNT_LOADING = 'PROCESSING_ACCOUNT_LOADING';
export const PROCESSING_ACCOUNT_LOADING_FAILED = 'PROCESSING_ACCOUNT_LOADING_FAILED';
export const PROCESSING_ACCOUNT_LOADING_COMPLETE = 'PROCESSING_ACCOUNT_LOADING_COMPLETE';
export const PROCESSING_REWARD_CLAIM = 'PROCESSING_REWARD_CLAIM';
export const PROCESSING_REWARD_CLAIM_COMPLETE = 'PROCESSING_REWARD_CLAIM_COMPLETE';
export const PROCESSING_ACCOUNT_CREATE = 'PROCESSING_ACCOUNT_CREATE';
export const PROCESSING_ACCOUNT_CREATE_CANCEL = 'PROCESSING_ACCOUNT_CREATE_CANCEL';
export const PROCESSING_ACCOUNT_CREATE_COMPLETE = 'PROCESSING_ACCOUNT_CREATE_COMPLETE';
export const PROCESSING_ACCOUNT_CREATE_FAILED = 'PROCESSING_ACCOUNT_CREATE_FAILED';
// Separate from account_create: claiming a token must NOT set account_create_resolved (that flag
// triggers the new-account key-import effect in Keys/Create).
export const PROCESSING_ACCOUNT_CLAIM = 'PROCESSING_ACCOUNT_CLAIM';
export const PROCESSING_ACCOUNT_CLAIM_COMPLETE = 'PROCESSING_ACCOUNT_CLAIM_COMPLETE';
export const PROCESSING_ACCOUNT_CLAIM_FAILED = 'PROCESSING_ACCOUNT_CLAIM_FAILED';

export function processingRewardClaim() {
  return {
    type: PROCESSING_REWARD_CLAIM,
  };
}

export function processingRewardClaimComplete() {
  return {
    type: PROCESSING_REWARD_CLAIM_COMPLETE,
  };
}

export function processingAccountCreate() {
  return {
    type: PROCESSING_ACCOUNT_CREATE,
  };
}

export function processingAccountCreateCancel() {
  return {
    type: PROCESSING_ACCOUNT_CREATE_CANCEL,
  };
}

export function processingAccountCreateComplete() {
  return {
    type: PROCESSING_ACCOUNT_CREATE_COMPLETE,
  };
}

export function processingAccountCreateFailed(payload: any) {
  return {
    type: PROCESSING_ACCOUNT_CREATE_FAILED,
    payload,
  };
}

export function processingAccountClaim() {
  return { type: PROCESSING_ACCOUNT_CLAIM };
}

export function processingAccountClaimComplete() {
  return { type: PROCESSING_ACCOUNT_CLAIM_COMPLETE };
}

export function processingAccountClaimFailed(payload: any) {
  return { type: PROCESSING_ACCOUNT_CLAIM_FAILED, payload };
}
