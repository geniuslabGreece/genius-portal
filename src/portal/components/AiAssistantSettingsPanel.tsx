import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Save, Eye, EyeOff, Loader2, KeyRound, Database } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Λίστα διαθέσιμων μοντέλων (Lovable AI Gateway).
 * Αν οριστεί custom_api_key, τότε το μοντέλο πάει στον custom provider (π.χ. OpenAI/OpenRouter)
 * με το ίδιο id, οπότε πρέπει να ταιριάζει με ό,τι δέχεται εκείνος.
 */
const MODEL_OPTIONS: { value: string; label: string; hint?: string }[] = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview) — default" },
  { value: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash — γρήγορο, ισορροπημένο" },
  { value: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite — φθηνότερο" },
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview) — καλύτερο reasoning" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "openai/gpt-5", label: "GPT-5" },
  { value: "openai/gpt-5-mini", label: "GPT-5 mini" },
  { value: "openai/gpt-5-nano", label: "GPT-5 nano" },
  { value: "openai/gpt-5.4", label: "GPT-5.4" },
  { value: "openai/gpt-5.4-mini", label: "GPT-5.4 mini" },
  { value: "openai/gpt-5.5", label: "GPT-5.5 — top capability" },
];

interface Settings {
  id?: string;
  model: string;
  system_prompt: string | null;
  custom_api_key: string | null;
  custom_base_url: string | null;
  temperature: number | null;
}

const empty: Settings = {
  model: "google/gemini-3-flash-preview",
  system_prompt: null,
  custom_api_key: null,
  custom_base_url: null,
  temperature: null,
};

export function AiAssistantSettingsPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(empty);
  const [showKey, setShowKey] = useState(false);
  const [newKey, setNewKey] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ai-assistant-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_assistant_settings")
        .select("*")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        id: data.id,
        model: data.model ?? empty.model,
        system_prompt: data.system_prompt ?? null,
        custom_api_key: data.custom_api_key ?? null,
        custom_base_url: data.custom_base_url ?? null,
        temperature: data.temperature ?? null,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (payload: Settings & { new_api_key?: string | null }) => {
      const patch: any = {
        model: payload.model,
        system_prompt: payload.system_prompt || null,
        custom_base_url: payload.custom_base_url || null,
        temperature: payload.temperature,
      };
      // Only update the api key if the user typed a new one (or explicitly cleared).
      if (payload.new_api_key !== undefined) {
        patch.custom_api_key = payload.new_api_key;
      }
      if (payload.id) {
        const { error } = await supabase
          .from("ai_assistant_settings")
          .update(patch)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_assistant_settings")
          .insert({ singleton: true, ...patch });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Οι ρυθμίσεις αποθηκεύτηκαν");
      setNewKey("");
      qc.invalidateQueries({ queryKey: ["ai-assistant-settings"] });
    },
    onError: (e: any) => toast.error("Αποτυχία", { description: e.message }),
  });

  if (isLoading) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </Card>
    );
  }

  const hasStoredKey = !!form.custom_api_key;

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold">AI Σύμβουλος — Ρυθμίσεις</h3>
          <p className="text-sm text-muted-foreground">
            Επιλέξτε μοντέλο και προαιρετικά custom API key/endpoint. Χωρίς custom key, χρησιμοποιείται το ενσωματωμένο Lovable AI Gateway.
          </p>
        </div>
      </div>

      <div className="grid gap-5">
        <div>
          <Label>Μοντέλο</Label>
          <Select
            value={form.model}
            onValueChange={(v) => setForm({ ...form, model: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Επιλεγμένο: <code className="font-mono">{form.model}</code>
          </p>
        </div>

        <div>
          <Label>Temperature (προαιρετικό)</Label>
          <Input
            type="number"
            min={0} max={2} step={0.1}
            value={form.temperature ?? ""}
            placeholder="π.χ. 0.7 (κενό = default μοντέλου)"
            onChange={(e) => setForm({ ...form, temperature: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>

        <div>
          <Label>System prompt (προαιρετικό)</Label>
          <Textarea
            rows={5}
            value={form.system_prompt ?? ""}
            placeholder="Άφησέ το κενό για το default prompt του portal."
            onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Αν οριστεί, αντικαθιστά το ενσωματωμένο system prompt.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Custom API Key (προαιρετικό)</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Αν οριστεί, το edge function καλεί το επιλεγμένο μοντέλο μέσω αυτού του key αντί του Lovable AI Gateway.
            Πρέπει το μοντέλο id να είναι συμβατό με τον provider σας. Παράδειγμα custom base URL: <code>https://openrouter.ai/api/v1</code>.
          </p>

          <div>
            <Label className="text-xs">Κατάσταση</Label>
            <div className="mt-1 flex items-center gap-2 text-sm">
              {hasStoredKey ? (
                <>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Αποθηκευμένο
                  </span>
                  <code className="font-mono text-xs text-muted-foreground">
                    {showKey ? form.custom_api_key : "•••••••••••••••"+String(form.custom_api_key ?? "").slice(-4)}
                  </code>
                  <Button size="sm" variant="ghost" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Χρήση Lovable AI Gateway (built-in).</span>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs">Νέο API Key</Label>
            <Input
              type="password"
              value={newKey}
              placeholder={hasStoredKey ? "Άφησέ το κενό για να μην αλλάξει" : "sk-..."}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs">Custom Base URL (προαιρετικό)</Label>
            <Input
              value={form.custom_base_url ?? ""}
              placeholder="https://api.openai.com/v1"
              onChange={(e) => setForm({ ...form, custom_base_url: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Άφησέ το κενό για default (<code>https://ai.gateway.lovable.dev/v1</code> όταν χρησιμοποιείται Lovable AI, αλλιώς OpenAI).
            </p>
          </div>

          {hasStoredKey && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => save.mutate({ ...form, new_api_key: null })}
              disabled={save.isPending}
            >
              Αφαίρεση custom key
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          onClick={() =>
            save.mutate({
              ...form,
              new_api_key: newKey.trim() ? newKey.trim() : undefined,
            })
          }
          disabled={save.isPending}
        >
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Αποθήκευση
        </Button>
      </div>
    </Card>
  );
}
