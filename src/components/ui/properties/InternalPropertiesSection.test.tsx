import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { InternalPropertiesSection } from './InternalPropertiesSection';
import { renderWithStore } from '../../../test/render';
import { getAppState, PAST_WELCOME } from '../../../test/store';

const props = {
  viewerTitle: 'Layer Plugin Data',
  modalTitle: 'カスタムレイヤー: A',
  modalSubtitle: 'プラグイン: p1',
};

describe('InternalPropertiesSection', () => {
  it('shows the plugin data and opens it in the full-screen dialog', async () => {
    const data = { seed: 42 };
    const { user } = renderWithStore(<InternalPropertiesSection data={data} {...props} />, PAST_WELCOME);

    expect(screen.getByText('内部プロパティ (Internal Properties)')).toBeInTheDocument();
    expect(screen.getByText('Layer Plugin Data')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /全画面ダイアログで開く/ }));

    expect(getAppState().pluginDataModalState).toEqual({
      isOpen: true,
      title: 'カスタムレイヤー: A',
      subtitle: 'プラグイン: p1',
      data,
    });
  });

  it('tells the user when there is no plugin data', () => {
    renderWithStore(<InternalPropertiesSection data={{}} {...props} />, PAST_WELCOME);

    expect(screen.getByText('内部プロパティ（plugin_data）はありません。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /全画面ダイアログで開く/ })).not.toBeInTheDocument();
  });

  it('renders nothing for empty data when hideWhenEmpty is set', () => {
    renderWithStore(<InternalPropertiesSection data={undefined} {...props} hideWhenEmpty />, PAST_WELCOME);

    expect(screen.queryByText('内部プロパティ (Internal Properties)')).not.toBeInTheDocument();
  });
});
