import React from 'react';
import { Alert, Button, Group, Modal, Text } from '@mantine/core';
import { IconKey } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { clearKeyError } from '../actions/keys';

/**
 * Surfaces an in-app operation authority error (set by useKey's KEY_USE_ROLE_MISMATCH gate) so it isn't
 * a silent no-op. The common case: clicking "Claim Pending Balances" (a posting-authority op) on an
 * account whose only loaded key is active/owner — post-HF28 hived rejects that, so the gate refuses it;
 * without this modal the button just appeared to do nothing.
 */
const KeyErrorModal: React.FC = () => {
  const roleError = useAppSelector((state) => state.keys?.roleError);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  if (!roleError) return null;

  const { message, required, account } = roleError as any;
  const close = () => dispatch(clearKeyError());

  return (
    <Modal
      opened
      onClose={close}
      title="Can't sign this operation"
      size="md"
      centered
      closeOnClickOutside
    >
      <Text>{message}</Text>
      {required && account ? (
        <Alert color="yellow" mt="md" title={`Import your ${String(required).toUpperCase()} key`}>
          The <strong>{String(required).toUpperCase()}</strong> key for <strong>@{account}</strong>{' '}
          isn&apos;t loaded in this wallet.
          {String(required) === 'posting'
            ? ' On Hive (post-HF28), posting operations such as claiming rewards must be signed with the posting key — the active or owner key cannot.'
            : ''}{' '}
          Import it under Accounts to continue.
        </Alert>
      ) : null}
      <Group justify="space-between" mt="lg">
        <Button variant="default" onClick={close}>
          Close
        </Button>
        {account ? (
          <Button
            leftSection={<IconKey size={16} />}
            onClick={() => {
              close();
              navigate('/accounts');
            }}
          >
            Manage keys
          </Button>
        ) : null}
      </Group>
    </Modal>
  );
};

export default KeyErrorModal;
