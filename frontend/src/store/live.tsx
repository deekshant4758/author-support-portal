import { createContext, useContext, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLiveEvents, type LiveStatus } from '../lib/useLiveEvents';
import { useAuth } from './auth';
import { useToast } from './toast';
import type { LiveEvent, Ticket } from '../lib/types';

const LiveContext = createContext<{ status: LiveStatus }>({ status: 'connecting' });

export const LiveProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { push } = useToast();

  const status = useLiveEvents((event: LiveEvent) => {
    // A single invalidation path keeps every screen consistent: the queue,
    // author lists, the open thread, dashboard metrics and AI analytics.
    void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    void queryClient.invalidateQueries({ queryKey: ['ticket'] });
    void queryClient.invalidateQueries({ queryKey: ['author-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-usage'] });

    if (event.type === 'ticket.created') {
      const ticket = event.data as Ticket | undefined;
      if (user?.role === 'ADMIN') {
        push(`New ticket ${ticket?.ticketNumber ?? ''} from ${ticket?.author?.name ?? 'an author'}`, 'info');
      }
    }

    if (event.type === 'ticket.message' && user?.role === 'AUTHOR') {
      push('BookLeaf replied to your ticket', 'info');
    }
  });

  return <LiveContext.Provider value={{ status }}>{children}</LiveContext.Provider>;
};

export const useLiveStatus = () => useContext(LiveContext).status;
