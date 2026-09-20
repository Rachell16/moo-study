import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; current: string };

export function NameDialog({ open, onOpenChange, current }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <NameForm current={current} close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NameForm({ current, close }: { current: string; close: () => void }) {
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const value = name.trim().slice(0, 30);
    if (!value) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { display_name: value } });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    toast.success(`Halo, ${value}!`);
    close();
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Nama panggilan</DialogTitle>
        <DialogDescription>
          Dipakai di sapaan beranda, misalnya “Selamat pagi, Budi!”.
        </DialogDescription>
      </DialogHeader>
      <input
        className="field w-full"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="mis. Rachel"
        aria-label="Nama panggilan"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={close}>
          Batal
        </Button>
        <Button type="submit" disabled={busy || !name.trim()}>
          Simpan
        </Button>
      </div>
    </form>
  );
}
