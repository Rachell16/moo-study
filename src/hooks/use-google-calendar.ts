import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { invalidateData } from "@/hooks/use-schedules";
import {
  disconnectGoogle,
  getGoogleStatus,
  startGoogleConnect,
  syncCalendar,
} from "@/lib/calendar.functions";

// Status koneksi + sinkron Google Calendar. Dipakai bersama oleh halaman Jadwal, Tugas, dan Ujian.
// `auto`: sinkron otomatis saat halaman dibuka dan tiap 5 menit (dipakai di halaman Jadwal saja).
export function useGoogleCalendar(userId: string | null, options: { auto?: boolean } = {}) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getGoogleStatus);
  const connectFn = useServerFn(startGoogleConnect);
  const disconnectFn = useServerFn(disconnectGoogle);
  const syncFn = useServerFn(syncCalendar);

  const status = useQuery({
    queryKey: ["google-status", userId],
    enabled: !!userId,
    queryFn: () => statusFn(),
  });
  const connected = !!status.data?.connected;
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const running = useRef(false);

  const sync = useCallback(
    async (silent = false) => {
      if (running.current) return;
      running.current = true;
      setSyncing(true);
      const total = { pushed: 0, pulled: 0, removed: 0, errors: [] as string[] };
      try {
        // Kirim bertahap: server memproses maksimal 30 agenda per panggilan.
        for (let i = 0; i < 60; i++) {
          const r = await syncFn();
          total.pushed += r.pushed;
          total.pulled += r.pulled;
          total.removed += r.removed;
          total.errors.push(...r.errors);
          if (r.remaining <= 0) break;
          setProgress(`Mengirim ke Google… ${total.pushed} terkirim, ${r.remaining} lagi`);
        }
        if (total.errors.length) toast.error(`Sebagian gagal dikirim: ${total.errors[0]}`);
        else if (!silent)
          toast.success(
            `Sinkron selesai: ${total.pushed} dikirim, ${total.pulled} diterima, ${total.removed} dihapus`,
          );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sinkron gagal.");
      } finally {
        running.current = false;
        setSyncing(false);
        setProgress(null);
        await Promise.all([
          invalidateData(qc),
          qc.invalidateQueries({ queryKey: ["google-status"] }),
        ]);
      }
    },
    [syncFn, qc],
  );

  // Panggil setelah menyimpan sesuatu; tidak berbuat apa-apa kalau Google belum tersambung.
  const syncSoon = useCallback(() => {
    if (connected) void sync(true);
  }, [connected, sync]);

  const connect = useCallback(async () => {
    try {
      const { url } = await connectFn({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tidak bisa memulai koneksi Google.");
    }
  }, [connectFn]);

  const disconnect = useCallback(async () => {
    await disconnectFn();
    await qc.invalidateQueries({ queryKey: ["google-status"] });
    toast("Google Calendar diputus. Agenda di sini dan di Google tidak dihapus.");
  }, [disconnectFn, qc]);

  const auto = !!options.auto;
  const autoSynced = useRef(false);
  useEffect(() => {
    if (!auto || !connected) return;
    if (!autoSynced.current) {
      autoSynced.current = true;
      void sync(true);
    }
    const id = window.setInterval(() => void sync(true), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [auto, connected, sync]);

  return { status, connected, syncing, progress, sync, syncSoon, connect, disconnect };
}
