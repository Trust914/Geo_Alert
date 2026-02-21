/**
 * BFF Sessions Manager
 * Component for viewing and managing active BFF sessions
 */

import { Monitor, Smartphone, Tablet, MapPin, Calendar, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useSessions, useRevokeSession } from "../hooks";
import { Card } from "../../../components/ui/";
import { Alert } from "../../../components/ui/";
import { Button } from "../../../components/ui/";
import { StepUp2FAModal } from "./StepUp2FAModal";

export function SessionsManager() {
  const { data: sessions, isLoading } = useSessions();
  const { mutate: revokeSession, isPending: isRevoking } = useRevokeSession();

  const [show2FAModal, setShow2FAModal] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return Smartphone;
    }
    if (ua.includes("tablet") || ua.includes("ipad")) {
      return Tablet;
    }
    return Monitor;
  };

  const getDeviceName = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("chrome")) return "Chrome";
    if (ua.includes("firefox")) return "Firefox";
    if (ua.includes("safari")) return "Safari";
    if (ua.includes("edge")) return "Edge";
    return "Unknown Browser";
  };

  const handleRevokeClick = (sessionId: string) => {
    setSessionToRevoke(sessionId);
    setShow2FAModal(true);
  };

  const handleConfirm2FA = (code: string) => {
    if (!sessionToRevoke) return;

    revokeSession(
      { sessionId: sessionToRevoke, twoFactorCode: code },
      {
        onSuccess: () => {
          setShow2FAModal(false);
          setSessionToRevoke(null);
        },
        onError: () => {
          // Keep modal open on error so user can retry
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading sessions...</p>
        </div>
      </Card>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card>
        <p className="text-center text-gray-600 py-8">No active sessions found</p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Alert variant="info">
          You have {sessions.length} active session{sessions.length !== 1 ? "s" : ""}. You
          can revoke access from any device you don't recognize.
        </Alert>

        {sessions.map((session) => {
          const DeviceIcon = getDeviceIcon(session.userAgent || "");
          const deviceName = getDeviceName(session.userAgent || "");

          return (
            <Card key={session.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="rounded-full bg-primary-100 p-2">
                    <DeviceIcon className="h-5 w-5 text-primary-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{deviceName}</h3>
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      {session.ipAddress && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{session.ipAddress}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>
                          Active{" "}
                          {formatDistanceToNow(new Date(session.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>

                    {session.userAgent && (
                      <p className="mt-2 text-xs text-gray-500 truncate">
                        {session.userAgent}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevokeClick(session.id)}
                  disabled={isRevoking}
                  leftIcon={<XCircle className="h-4 w-4" />}
                  className="ml-4 flex-shrink-0"
                >
                  Revoke
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <StepUp2FAModal
        isOpen={show2FAModal}
        onClose={() => {
          setShow2FAModal(false);
          setSessionToRevoke(null);
        }}
        onConfirm={handleConfirm2FA}
        isLoading={isRevoking}
        title="Verify to Revoke Session"
        description="For security, please enter your 2FA code to revoke this session."
      />
    </>
  );
}