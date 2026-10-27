import React from 'react';
import { TextInput } from '@mantine/core';

export default function OperationsPromptFieldPercent(props: any) {
  const { field, meta, opData } = props;

  const modifyPercent = (e: any) => {
    const value = e.currentTarget.value;
    const name = field;
    const amount: any = parseFloat(value).toFixed(3);
    props.modifyOpsPrompt(null, {
      index: 0,
      name,
      value: amount * 100,
    });
  };

  const defaultValue = opData[field] ? (parseFloat(opData[field]) / 100).toFixed(2) : 100;
  return (
    <TextInput
      key={field}
      required
      name={field}
      label={meta.label}
      defaultValue={defaultValue}
      onChange={modifyPercent}
      leftSection="%"
    />
  );
}
