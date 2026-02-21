import { useQuery } from '@tanstack/react-query';
import { twoFactorService } from '../services';
import { QUERY_KEYS } from '../../../lib/reactQuery';

export function use2FAStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.TWO_FACTOR.STATUS,
    queryFn: twoFactorService.getStatus,
  });
}