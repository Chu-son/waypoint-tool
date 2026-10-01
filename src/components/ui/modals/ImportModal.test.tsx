import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ImportModal } from './ImportModal';
import { BackendAPI, DialogAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState, PAST_WELCOME } from '../../../test/store';

const RAW_POSES = [
  { x: 1, y: 2, yaw: 0 },
  { x: 3, y: 4, yaw: 0 },
];

describe('ImportModal (waypoints)', () => {
  it('renders nothing while closed', () => {
    const { container } = renderWithStore(<ImportModal isOpen={false} onClose={vi.fn()} />, PAST_WELCOME);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps Import disabled until a file is chosen', () => {
    renderWithStore(<ImportModal isOpen onClose={vi.fn()} />, PAST_WELCOME);
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('adds the waypoints of the chosen file to the project and closes', async () => {
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/tmp/poses.yaml');
    vi.spyOn(BackendAPI, 'importWaypointsRaw').mockResolvedValue(RAW_POSES);
    vi.spyOn(DialogAPI, 'message').mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { user } = renderWithStore(<ImportModal isOpen onClose={onClose} />, PAST_WELCOME);

    await user.click(screen.getByRole('button', { name: 'Browse' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const state = getAppState();
    expect(state.rootNodeIds).toHaveLength(2);
    const positions = state.rootNodeIds.map((id) => [state.nodes[id].transform?.x, state.nodes[id].transform?.y]);
    expect(positions).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('previews the number of waypoints without adding them', async () => {
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/tmp/poses.yaml');
    vi.spyOn(BackendAPI, 'importWaypointsRaw').mockResolvedValue(RAW_POSES);
    const { user } = renderWithStore(<ImportModal isOpen onClose={vi.fn()} />, PAST_WELCOME);

    await user.click(screen.getByRole('button', { name: 'Browse' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText('2 waypoint(s) ready to import')).toBeInTheDocument();
    expect(getAppState().rootNodeIds).toHaveLength(0);
  });
});
