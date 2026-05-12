import test from 'node:test';
import assert from 'node:assert/strict';

import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';

function makeServer() {
  const emissions: any[] = [];
  return {
    emissions,
    server: {
      emit: (event: string, data: unknown) => { emissions.push({ scope: 'broadcast', event, data }); },
      to: (room: string) => ({
        emit: (event: string, data: unknown) => { emissions.push({ scope: room, event, data }); }
      })
    }
  };
}

test('RealtimeGateway broadcasts listing.created to all sockets as listing:created', () => {
  const { emissions, server } = makeServer();
  const gateway = new RealtimeGateway(
    { getSessionUser: async () => null } as any,
    { resolveIdentity: async () => null } as any
  );
  (gateway as any).server = server;

  gateway.handleListingCreated({ listingId: 'l1', sellerId: 's1', brandId: 'b1', status: 'ACTIVE' } as any);

  assert.deepEqual(emissions, [{
    scope: 'broadcast',
    event: 'listing:created',
    data: { listingId: 'l1', sellerId: 's1', brandId: 'b1', status: 'ACTIVE' }
  }]);
});

test('RealtimeGateway broadcasts listing.updated as listing:updated', () => {
  const { emissions, server } = makeServer();
  const gateway = new RealtimeGateway(
    { getSessionUser: async () => null } as any,
    { resolveIdentity: async () => null } as any
  );
  (gateway as any).server = server;

  gateway.handleListingUpdated({ listingId: 'l1', status: 'SOLD' } as any);

  assert.deepEqual(emissions, [{
    scope: 'broadcast',
    event: 'listing:updated',
    data: { listingId: 'l1', status: 'SOLD' }
  }]);
});

test('RealtimeGateway.isUserConnected returns true when sockets exist in user room', async () => {
  const gateway = new RealtimeGateway(
    { getSessionUser: async () => null } as any,
    { resolveIdentity: async () => null } as any
  );
  (gateway as any).server = {
    in: (room: string) => ({
      fetchSockets: async () => (room === 'user:u1' ? [{}, {}] : [])
    })
  };

  assert.equal(await gateway.isUserConnected('u1'), true);
  assert.equal(await gateway.isUserConnected('u2'), false);
});

test('RealtimeGateway joins admin room when token validates as admin', async () => {
  const adminAccessService: any = {
    resolveIdentity: async (t: string) => (t === 'admintok' ? { kind: 'session', adminId: 'a1', role: 'ADMIN' } : null)
  };
  const authService: any = { getSessionUser: async () => null };
  const gateway = new RealtimeGateway(authService, adminAccessService);

  const joinedRooms: string[] = [];
  const socket: any = {
    handshake: { auth: { token: 'admintok' } },
    data: {},
    join: async (room: string) => { joinedRooms.push(room); },
    disconnect: () => { joinedRooms.push('DISCONNECT'); }
  };

  await gateway.handleConnection(socket);
  assert.deepEqual(joinedRooms, ['admin']);
});

test('RealtimeGateway disconnects when token is neither user nor admin', async () => {
  const gateway = new RealtimeGateway(
    { getSessionUser: async () => null } as any,
    { resolveIdentity: async () => null } as any
  );

  const events: string[] = [];
  const socket: any = {
    handshake: { auth: { token: 'bad' } },
    data: {},
    join: async (room: string) => { events.push(`join:${room}`); },
    disconnect: () => { events.push('disconnect'); }
  };

  await gateway.handleConnection(socket);
  assert.deepEqual(events, ['disconnect']);
});

test('RealtimeGateway emits order:updated to admin room as well', () => {
  const { emissions, server } = makeServer();
  const gateway = new RealtimeGateway(
    { getSessionUser: async () => null } as any,
    { resolveIdentity: async () => null } as any
  );
  (gateway as any).server = server;

  gateway.handleOrderUpdated({ buyerId: 'b1', sellerId: 's1', orderId: 'o1', status: 'CONFIRMED' } as any);

  const adminEmit = emissions.find(e => e.scope === 'admin');
  assert.ok(adminEmit, 'expected an admin-room emit');
  assert.equal(adminEmit.event, 'order:updated');
  assert.deepEqual(adminEmit.data, { orderId: 'o1', status: 'CONFIRMED' });
});

test('RealtimeGateway forwards dispute.created to admin room as dispute:opened', () => {
  const { emissions, server } = makeServer();
  const gateway = new RealtimeGateway(
    { getSessionUser: async () => null } as any,
    { resolveIdentity: async () => null } as any
  );
  (gateway as any).server = server;

  gateway.handleDisputeCreated({
    orderId: 'o1', listingId: 'l1', buyerId: 'b1', sellerId: 's1', raisedByUserId: 'b1'
  } as any);

  assert.deepEqual(emissions, [{
    scope: 'admin',
    event: 'dispute:opened',
    data: { orderId: 'o1', listingId: 'l1' }
  }]);
});
