import React, { useState } from 'react';
import { Group, Input, Select, TextInput } from '@mantine/core';

export default function OperationsPromptFieldAsset(props: any) {
  const { field, meta, opData } = props;

  let defaultAsset = 'HIVE';
  if (meta.type === 'hbd') {
    defaultAsset = 'HBD';
  }

  const [assetType, setAssetType] = useState(defaultAsset);
  const [assetAmount, setAssetAmount] = useState<any>(0);

  const modifyAssetAmount = (e: any) => {
    const value = e.currentTarget.value;
    const name = field;
    const amount = parseFloat(value).toFixed(3);
    setAssetAmount(amount);
    props.modifyOpsPrompt(null, {
      index: 0,
      name,
      value: [amount, assetType].join(' '),
    });
  };

  const modifyAssetType = (value: any) => {
    const name = field;
    setAssetType(value);
    props.modifyOpsPrompt(null, {
      index: 0,
      name,
      value: [assetAmount, value].join(' '),
    });
  };

  const defaultValue = opData[field] ? parseFloat(opData[field].split(' ')[0]) : 0;
  const options: any[] = [];
  const option_hive = { value: 'HIVE', label: 'HIVE' };
  const option_hbd = { value: 'HBD', label: 'HBD' };
  switch (meta.type) {
    case 'asset':
      options.push(option_hive, option_hbd);
      break;
    case 'hbd':
      options.push(option_hbd);
      break;
    case 'hive':
      options.push(option_hive);
      break;
  }

  return (
    <Input.Wrapper label={meta.label} required>
      <Group gap={0} align="flex-start" wrap="nowrap">
        <Select
          name={field}
          defaultValue={defaultAsset}
          data={options}
          onChange={modifyAssetType}
          allowDeselect={false}
          w={110}
        />
        <TextInput
          key={field}
          required
          name={field}
          defaultValue={defaultValue}
          onChange={modifyAssetAmount}
          style={{ flex: 1 }}
        />
      </Group>
    </Input.Wrapper>
  );
}
