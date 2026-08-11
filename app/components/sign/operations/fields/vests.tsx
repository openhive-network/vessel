import React, { useState } from 'react';
import { Group, Input, Select, TextInput } from '@mantine/core';

export default function OperationsPromptFieldVests(props: any) {
  const [assetType, setAssetType] = useState('VESTS');
  const [assetAmount, setAssetAmount] = useState<any>(0);

  const updateVests = (nextAmount: any, nextType: any) => {
    const { field } = props;
    let vests = [nextAmount, 'VESTS'].join(' ');
    if (nextType === 'HP') {
      const { total_vesting_fund_hive, total_vesting_shares } = props.hive.props;
      const vesting_hive = parseFloat(total_vesting_fund_hive.split(' ')[0]);
      const vesting_shares = parseFloat(total_vesting_shares.split(' ')[0]);
      const converted = ((nextAmount / vesting_hive) * vesting_shares).toFixed(6);
      vests = [converted, 'VESTS'].join(' ');
    }
    props.modifyOpsPrompt(null, {
      index: 0,
      name: field,
      value: vests,
    });
  };

  const modifyAssetAmount = (e: any, { value, name }: any) => {
    let amount = parseFloat(value).toFixed(6);
    if (assetType === 'HP') {
      amount = parseFloat(value).toFixed(3);
    }
    setAssetAmount(amount);
    updateVests(amount, assetType);
  };

  const modifyAssetType = (e: any, { value, name }: any) => {
    setAssetType(value);
    updateVests(assetAmount, value);
  };

  const { field, meta, opData } = props;
  const defaultValue = opData[field] ? parseFloat(opData[field].split(' ')[0]) : 0;
  return (
    <Input.Wrapper label={meta.label} required>
      <Group gap={0} align="flex-start" wrap="nowrap">
        <TextInput
          key={field}
          required
          name={field}
          defaultValue={defaultValue}
          onChange={(e) => modifyAssetAmount(e, { value: e.currentTarget.value, name: field })}
          style={{ flex: 1 }}
        />
        <Select
          name={field}
          defaultValue="VESTS"
          onChange={(value) => modifyAssetType(null, { value, name: field })}
          data={[
            { value: 'VESTS', label: 'VESTS' },
            { value: 'HP', label: 'HP' },
          ]}
          allowDeselect={false}
          w={110}
        />
      </Group>
    </Input.Wrapper>
  );
}
