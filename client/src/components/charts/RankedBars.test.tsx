import { render, screen } from '@testing-library/react';
import { RankedBars } from './RankedBars';

describe('RankedBars', () => {
  it('scales bars relative to the largest value', () => {
    const { container } = render(
      <RankedBars items={[{ key: 'a', label: 'Alpha', value: 200, display: '₹200' }, { key: 'b', label: 'Beta', value: 50, display: '₹50' }]} />,
    );
    const bars = container.querySelectorAll<HTMLDivElement>('.bg-brand-500');
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].style.width).toBe('25%');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('renders an empty message', () => {
    render(<RankedBars items={[]} empty="Nothing sold" />);
    expect(screen.getByText('Nothing sold')).toBeInTheDocument();
  });
});
