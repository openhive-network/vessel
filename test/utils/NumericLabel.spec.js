import React from 'react';
import renderer from 'react-test-renderer';
import NumericLabel from '../../app/utils/NumericLabel';

describe('NumericLabel', () => {
  it('shortens large numbers and keeps the exact value as the title', () => {
    const tree = renderer.create(
      <NumericLabel params={{ shortFormat: true, title: true }}>{1500}</NumericLabel>
    ).toJSON();
    expect(tree.type).toBe('span');
    expect(tree.props.title).toBe(1500);
    expect(tree.children).toEqual(['1.500k']);
  });

  it('renders zero for an empty amount', () => {
    const tree = renderer.create(<NumericLabel>{0}</NumericLabel>).toJSON();
    expect(tree.children).toEqual(['0']);
  });
});
