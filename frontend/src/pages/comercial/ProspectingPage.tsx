import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Building2, CheckCircle2, CircleDollarSign, Clock3, ExternalLink,
  FileSpreadsheet, Inbox, Mail, MapPin, Phone, RefreshCw, Search, Settings2,
  ShieldCheck, Sparkles, Target, UserRoundCheck, Users, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { PageHeader } from '../../shared/components/layout/PageHeader';
import { Badge } from '../../shared/components/ui/Badge';
import { Button } from '../../shared/components/ui/Button';
import { Card } from '../../shared/components/ui/Card';
import { EmptyState } from '../../shared/components/ui/EmptyState';

type ProspectStatus = 'new' | 'approved' | 'contacted' | 'interested' | 'emailing' | 'replied' | 'rejected' | 'suppressed' | 'converted' | 'sequence_complete';
type View = 'queue' | 'all' | 'conversations' | 'settings';

interface Prospect {
  id: string;
  cnpj: string;
  company_name: string;
  trade_name?: string | null;
  cnae_code?: string | null;
  cnae_description?: string | null;
  segment?: string | null;
  opened_at?: string | null;
  company_size?: string | null;
  capital_social?: number | null;
  city?: string | null;
  state?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  employee_confidence: 'low' | 'medium' | 'high';
  employee_evidence: string[];
  score: number;
  score_reasons: string[];
  status: ProspectStatus;
  contact_permission: boolean;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  assigned_at?: string | null;
  source: string;
  source_url?: string | null;
  last_contact_at?: string | null;
  next_action_at?: string | null;
  follow_up_step: number;
  converted_lead_id?: string | null;
}

interface Activity {
  id: string;
  prospect_id: string;
  kind: string;
  channel: string;
  direction: string;
  subject?: string | null;
  body?: string | null;
  occurred_at: string;
}

interface TeamMember { id: number; full_name: string; email: string }

interface Config {
  source: { provider: string; configured: boolean; price_per_company_cents: number };
  email: { provider: string; address: string; configured: boolean; dry_run: boolean };
  scheduler: boolean;
  privacy_url: string;
  campaign: {
    id: number; status: 'active' | 'paused'; seller_ids: number[]; daily_per_seller: number;
    monthly_budget_cents: number; spent_cents: number; spent_month: string; last_discovery_at?: string | null;
  };
}

interface Summary {
  total: number;
  statuses: Record<string, number>;
  monthly: { qualified: number; returns: number; opportunities: number; demonstrations: number; converted: number };
  goals: { qualified: number; returns: number; opportunities: number; demonstrations: number; converted: number };
  budget: { spent_cents: number; limit_cents: number };
}

const STATUS: Record<ProspectStatus, { label: string; tone: 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate' | 'blue' }> = {
  new: { label: 'Para revisar', tone: 'cyan' },
  approved: { label: 'Abordagem aprovada', tone: 'violet' },
  contacted: { label: 'Contato realizado', tone: 'amber' },
  interested: { label: 'Demonstrou interesse', tone: 'emerald' },
  emailing: { label: 'Em acompanhamento', tone: 'blue' },
  replied: { label: 'Resposta recebida', tone: 'blue' },
  rejected: { label: 'Sem interesse', tone: 'slate' },
  suppressed: { label: 'Não contatar', tone: 'rose' },
  converted: { label: 'Convertido em lead', tone: 'emerald' },
  sequence_complete: { label: 'Sequência concluída', tone: 'slate' },
};

const CONFIDENCE = {
  low: { label: 'Baixa confiança em 6+ funcionários', tone: 'rose' as const },
  medium: { label: 'Provável 6+ funcionários', tone: 'amber' as const },
  high: { label: 'Alta confiança em 6+ funcionários', tone: 'emerald' as const },
};

const inputClass = 'min-h-11 w-full rounded-xl border px-3 text-sm outline-none transition-colors focus:border-violet-400';

function companyName(prospect: Prospect) { return prospect.trade_name || prospect.company_name; }

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').padEnd(14, ' ');
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`.trim();
}

function formatDate(value?: string | null) {
  if (!value) return 'Não informado';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Ainda não executado';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function moneyFromCents(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}

function errorMessage(error: any, fallback: string) {
  return error?.response?.data?.detail || error?.response?.data?.message || fallback;
}

function SummaryStrip({ summary }: { summary: Summary }) {
  const items = [
    { label: 'Qualificadas', value: summary.monthly.qualified, goal: summary.goals.qualified },
    { label: 'Retornos', value: summary.monthly.returns, goal: summary.goals.returns },
    { label: 'Oportunidades', value: summary.monthly.opportunities, goal: summary.goals.opportunities },
    { label: 'Demonstrações', value: summary.monthly.demonstrations, goal: summary.goals.demonstrations },
    { label: 'Conversões', value: summary.monthly.converted, goal: summary.goals.converted },
  ];
  return (
    <section className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: 'var(--erp-border)' }} aria-label="Metas do mês">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item, index) => {
          const progress = Math.min(100, Math.round((item.value / Math.max(1, item.goal)) * 100));
          return (
            <div key={item.label} className={`px-4 py-3.5 ${index ? 'border-l' : ''}`} style={{ borderColor: 'var(--erp-border)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>{item.label}</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>{item.value}</span>
                <span className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>/ {item.goal}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--erp-surface-3)' }}>
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: progress >= 100 ? 'var(--erp-emerald)' : 'var(--erp-violet)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Score({ value }: { value: number }) {
  const color = value >= 75 ? 'var(--erp-emerald)' : value >= 55 ? 'var(--erp-amber)' : 'var(--erp-rose)';
  return (
    <div
      className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2"
      style={{ borderColor: color }}
      role="meter"
      aria-label={`Aderência ${value} de 100`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span className="text-sm font-bold leading-none" style={{ color }}>{value}</span>
      <span className="mt-0.5 text-[8px] font-semibold uppercase" style={{ color }}>fit</span>
    </div>
  );
}

function ProspectRow({ prospect, selected, onSelect }: { prospect: Prospect; selected: boolean; onSelect: () => void }) {
  const confidence = CONFIDENCE[prospect.employee_confidence] || CONFIDENCE.low;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 border-b px-3 py-4 text-left transition-colors last:border-b-0 hover:bg-[var(--erp-surface-2)] sm:px-4"
      style={{ borderColor: 'var(--erp-border)', background: selected ? 'var(--erp-violet-dim)' : undefined }}
    >
      <Score value={prospect.score} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="max-w-full truncate text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>{companyName(prospect)}</h2>
          <Badge tone={STATUS[prospect.status].tone} dot>{STATUS[prospect.status].label}</Badge>
        </div>
        <p className="mt-1 truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{prospect.segment || prospect.cnae_description || 'Segmento não identificado'}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--erp-text-muted)' }}>
          <span className="inline-flex items-center gap-1"><MapPin size={11} />{[prospect.city, prospect.state].filter(Boolean).join(' · ') || 'Local não informado'}</span>
          <span className="inline-flex items-center gap-1"><Clock3 size={11} />Aberta em {formatDate(prospect.opened_at)}</span>
          <span>{confidence.label}</span>
        </div>
      </div>
      <ArrowRight size={16} className="mt-3 shrink-0" style={{ color: 'var(--erp-text-dim)' }} />
    </button>
  );
}

interface DetailProps {
  prospect: Prospect;
  activities: Activity[];
  config: Config;
  onRefresh: () => Promise<void>;
}

function ProspectDetail({ prospect, activities, config, onRefresh }: DetailProps) {
  const navigate = useNavigate();
  const [working, setWorking] = useState('');
  const [note, setNote] = useState('Conversei com a empresa para entender como realizam o controle de jornada.');
  const [draft, setDraft] = useState({ subject: '', email: '', call_script: '' });

  useEffect(() => { setDraft({ subject: '', email: '', call_script: '' }); }, [prospect.id]);

  async function action(label: string, request: () => Promise<unknown>, success: string) {
    setWorking(label);
    try {
      await request();
      toast.success(success);
      await onRefresh();
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível concluir a ação.'));
      return false;
    } finally {
      setWorking('');
    }
  }

  async function generate() {
    setWorking('draft');
    try {
      const { data } = await api.post(`/prospecting/prospects/${prospect.id}/draft`);
      setDraft(data);
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível preparar a abordagem.'));
    } finally {
      setWorking('');
    }
  }

  const confidence = CONFIDENCE[prospect.employee_confidence] || CONFIDENCE.low;
  const prospectActivities = activities.filter((item) => item.prospect_id === prospect.id).slice(0, 8);
  const canContact = !['suppressed', 'converted', 'rejected'].includes(prospect.status);

  return (
    <aside className="min-w-0 border-t bg-white lg:border-l lg:border-t-0" style={{ borderColor: 'var(--erp-border)' }}>
      <div className="border-b p-4 sm:p-5" style={{ borderColor: 'var(--erp-border)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>{prospect.company_name}</p>
            <h2 className="mt-0.5 text-lg font-bold" style={{ color: 'var(--erp-text)' }}>{companyName(prospect)}</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{formatCnpj(prospect.cnpj)}</p>
            {prospect.source_url ? <a className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold underline" style={{ color: 'var(--erp-violet)' }} href={prospect.source_url} target="_blank" rel="noreferrer">Ver fonte pública <ExternalLink size={11} /></a> : null}
          </div>
          <Score value={prospect.score} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={STATUS[prospect.status].tone} dot>{STATUS[prospect.status].label}</Badge>
          <Badge tone={confidence.tone}>{confidence.label}</Badge>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <section>
          <h3 className="text-xs font-semibold" style={{ color: 'var(--erp-text)' }}>Por que está na lista</h3>
          <ul className="mt-2 space-y-1.5">
            {[...prospect.score_reasons, ...prospect.employee_evidence].map((reason) => (
              <li key={reason} className="flex gap-2 text-xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}><CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--erp-emerald)' }} />{reason}</li>
            ))}
          </ul>
        </section>

        <section className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <a href={prospect.phone ? `tel:${prospect.phone}` : undefined} className="flex min-h-11 items-center gap-2 rounded-xl px-3" style={{ background: 'var(--erp-surface-2)', color: prospect.phone ? 'var(--erp-text)' : 'var(--erp-text-dim)' }}><Phone size={14} />{prospect.phone || 'Telefone não informado'}</a>
          <a href={prospect.email ? `mailto:${prospect.email}` : undefined} className="flex min-h-11 items-center gap-2 rounded-xl px-3" style={{ background: 'var(--erp-surface-2)', color: prospect.email ? 'var(--erp-text)' : 'var(--erp-text-dim)' }}><Mail size={14} /><span className="truncate">{prospect.email || 'E-mail não informado'}</span></a>
          <div className="flex min-h-11 items-center gap-2 rounded-xl px-3" style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)' }}><Building2 size={14} /><span className="truncate">{prospect.company_size || 'Porte não informado'}</span></div>
          <div className="flex min-h-11 items-center gap-2 rounded-xl px-3" style={{ background: 'var(--erp-surface-2)', color: 'var(--erp-text-muted)' }}><UserRoundCheck size={14} /><span className="truncate">{prospect.assigned_to_name || 'Ainda sem responsável'}</span></div>
        </section>

        {canContact ? (
          <section>
            <label className="text-xs font-semibold" htmlFor="prospect-note" style={{ color: 'var(--erp-text)' }}>Registro da abordagem</label>
            <textarea id="prospect-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} className={`${inputClass} mt-2 resize-y py-2.5`} style={{ background: 'var(--erp-surface-2)', borderColor: 'var(--erp-border)', color: 'var(--erp-text)' }} />
            <div className="mt-2 flex flex-wrap gap-2">
              {prospect.status === 'new' ? <Button size="sm" loading={working === 'approve'} onClick={() => action('approve', () => api.post(`/prospecting/prospects/${prospect.id}/approve`), 'Abordagem aprovada.')} icon={<ShieldCheck size={14} />}>Aprovar</Button> : null}
              <Button size="sm" variant="secondary" loading={working === 'call'} onClick={() => action('call', () => api.post(`/prospecting/prospects/${prospect.id}/contact`, { outcome: 'call_made', note }), 'Ligação registrada.')} icon={<Phone size={14} />}>Registrar ligação</Button>
              <Button size="sm" variant="outline" loading={working === 'interest'} onClick={() => action('interest', () => api.post(`/prospecting/prospects/${prospect.id}/contact`, { outcome: 'interested', note }), 'Interesse registrado; o envio por e-mail foi liberado.')} icon={<CheckCircle2 size={14} />}>Tem interesse</Button>
              <Button size="sm" variant="ghost" loading={working === 'reject'} onClick={() => action('reject', () => api.post(`/prospecting/prospects/${prospect.id}/contact`, { outcome: 'no_interest', note: note || 'Informou que não tem interesse.' }), 'Empresa adicionada à lista de não contato.')} icon={<XCircle size={14} />}>Sem interesse</Button>
            </div>
          </section>
        ) : null}

        <section>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold" style={{ color: 'var(--erp-text)' }}>Abordagem sugerida</h3>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--erp-text-muted)' }}>A IA usa apenas os dados públicos exibidos acima.</p>
            </div>
            <Button size="xs" variant="outline" loading={working === 'draft'} onClick={generate} icon={<Sparkles size={13} />}>Preparar</Button>
          </div>
          {draft.call_script ? <div className="mt-2 rounded-xl p-3 text-xs leading-relaxed" style={{ background: 'var(--erp-violet-dim)', color: 'var(--erp-text)' }}>{draft.call_script}</div> : null}
          {draft.email ? (
            <div className="mt-3 space-y-2">
              <input aria-label="Assunto do e-mail" value={draft.subject} onChange={(event) => setDraft((value) => ({ ...value, subject: event.target.value }))} className={inputClass} style={{ background: 'var(--erp-surface-2)', borderColor: 'var(--erp-border)', color: 'var(--erp-text)' }} />
              <textarea aria-label="Mensagem do e-mail" value={draft.email} onChange={(event) => setDraft((value) => ({ ...value, email: event.target.value }))} rows={8} className={`${inputClass} resize-y py-2.5`} style={{ background: 'var(--erp-surface-2)', borderColor: 'var(--erp-border)', color: 'var(--erp-text)' }} />
              <Button
                size="sm"
                disabled={!prospect.contact_permission || !prospect.email || !config.email.configured}
                loading={working === 'send'}
                onClick={() => action('send', () => api.post(`/prospecting/prospects/${prospect.id}/send-email`, { subject: draft.subject, body: draft.email }), config.email.dry_run ? 'Simulação concluída; nenhum e-mail foi enviado.' : 'E-mail enviado pela caixa comercial.')}
                icon={<Mail size={14} />}
              >Enviar pela 4Core</Button>
              {!prospect.contact_permission ? <p className="text-[11px]" style={{ color: 'var(--erp-amber)' }}>O envio só é liberado depois de registrar o interesse.</p> : null}
            </div>
          ) : null}
        </section>

        {prospect.status === 'interested' || prospect.status === 'emailing' ? (
          <section className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--erp-border)' }}>
            <Button size="sm" variant="secondary" onClick={() => action('demo', () => api.post(`/prospecting/prospects/${prospect.id}/demonstration`), 'Demonstração registrada.')} icon={<Target size={14} />}>Registrar demonstração</Button>
            <Button size="sm" loading={working === 'convert'} onClick={async () => { if (await action('convert', () => api.post(`/prospecting/prospects/${prospect.id}/convert`), 'Prospecto convertido em lead.')) navigate('/comercial/leads'); }} icon={<ArrowRight size={14} />}>Converter em lead</Button>
          </section>
        ) : null}

        <section>
          <h3 className="text-xs font-semibold" style={{ color: 'var(--erp-text)' }}>Histórico</h3>
          <div className="mt-2 space-y-2">
            {prospectActivities.length ? prospectActivities.map((activity) => (
              <div key={activity.id} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--erp-surface-2)' }}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold" style={{ color: activity.direction === 'inbound' ? 'var(--erp-emerald)' : 'var(--erp-text)' }}>{activity.direction === 'inbound' ? 'Resposta recebida' : activity.kind.replace(/_/g, ' ')}</span>
                  <span style={{ color: 'var(--erp-text-muted)' }}>{formatDateTime(activity.occurred_at)}</span>
                </div>
                {activity.subject ? <p className="mt-1 truncate text-xs font-medium" style={{ color: 'var(--erp-text)' }}>{activity.subject}</p> : null}
                {activity.body ? <p className="mt-1 line-clamp-3 text-xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>{activity.body}</p> : null}
              </div>
            )) : <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>Nenhuma interação registrada.</p>}
          </div>
        </section>
      </div>
    </aside>
  );
}

function SettingsView({ config, team, onSaved }: { config: Config; team: TeamMember[]; onSaved: () => Promise<void> }) {
  const [sellerIds, setSellerIds] = useState<number[]>(config.campaign.seller_ids);
  const [saving, setSaving] = useState(false);
  const budgetPercent = Math.min(100, Math.round((config.campaign.spent_cents / Math.max(1, config.campaign.monthly_budget_cents)) * 100));

  async function save() {
    setSaving(true);
    try {
      await api.patch('/prospecting/campaign', { seller_ids: sellerIds, daily_per_seller: 5, monthly_budget_cents: 5000 });
      toast.success('Configuração da campanha salva.');
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível salvar a configuração.'));
    } finally {
      setSaving(false);
    }
  }

  function toggleSeller(id: number) {
    setSellerIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 3 ? [...current, id] : current);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
      <Card>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Distribuição para o time</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>Selecione até três usuários. Cada um receberá cinco novos prospectos por dia útil.</p>
        <div className="mt-4 divide-y rounded-xl border" style={{ borderColor: 'var(--erp-border)' }}>
          {team.map((member) => {
            const selected = sellerIds.includes(member.id);
            return (
              <label key={member.id} className="flex min-h-14 cursor-pointer items-center gap-3 px-3" style={{ borderColor: 'var(--erp-border)', background: selected ? 'var(--erp-violet-dim)' : 'transparent' }}>
                <input type="checkbox" checked={selected} onChange={() => toggleSeller(member.id)} disabled={!selected && sellerIds.length >= 3} className="h-4 w-4 accent-[#2b165c]" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium" style={{ color: 'var(--erp-text)' }}>{member.full_name}</span><span className="block truncate text-xs" style={{ color: 'var(--erp-text-muted)' }}>{member.email}</span></span>
                {selected ? <Badge tone="violet">5 por dia</Badge> : null}
              </label>
            );
          })}
        </div>
        <div className="mt-4"><Button onClick={save} loading={saving} disabled={sellerIds.length === 0}>Salvar responsáveis</Button></div>
      </Card>

      <div className="space-y-4">
        <Card>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Integrações</h2>
          <div className="mt-3 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3"><span style={{ color: 'var(--erp-text-muted)' }}>Casa dos Dados</span><Badge tone={config.source.configured ? 'emerald' : 'amber'} dot>{config.source.configured ? 'Configurada' : 'Falta a chave'}</Badge></div>
            <div className="flex items-center justify-between gap-3"><span style={{ color: 'var(--erp-text-muted)' }}>Hostinger · {config.email.address}</span><Badge tone={config.email.configured ? 'emerald' : 'amber'} dot>{config.email.configured ? 'Configurada' : 'Falta a senha'}</Badge></div>
            <div className="flex items-center justify-between gap-3"><span style={{ color: 'var(--erp-text-muted)' }}>Automação diária</span><Badge tone={config.scheduler ? 'emerald' : 'amber'} dot>{config.scheduler ? 'Configurada' : 'Falta o segredo'}</Badge></div>
            {config.email.dry_run ? <div className="rounded-xl p-3 leading-relaxed" style={{ background: '#fffbeb', color: 'var(--erp-amber)' }}>Modo seguro ativo: o ERP prepara os e-mails, mas não envia até PROSPECTING_DRY_RUN ser desativado.</div> : null}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Orçamento mensal</h2><strong className="text-sm" style={{ color: 'var(--erp-text)' }}>{moneyFromCents(config.campaign.spent_cents)} / {moneyFromCents(config.campaign.monthly_budget_cents)}</strong></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--erp-surface-3)' }}><div className="h-full rounded-full" style={{ width: `${budgetPercent}%`, background: budgetPercent >= 80 ? 'var(--erp-amber)' : 'var(--erp-violet)' }} /></div>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--erp-text-muted)' }}>A busca para automaticamente ao atingir R$ 50 no mês.</p>
        </Card>
      </div>
    </div>
  );
}

export default function ProspectingPage() {
  const [view, setView] = useState<View>('queue');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [prospectResponse, activityResponse, configResponse, summaryResponse, teamResponse, meResponse] = await Promise.all([
        api.get<Prospect[]>('/prospecting/prospects?limit=300'),
        api.get<Activity[]>('/prospecting/activities?limit=300'),
        api.get<Config>('/prospecting/config'),
        api.get<Summary>('/prospecting/summary'),
        api.get<TeamMember[]>('/auth/users'),
        api.get<TeamMember>('/auth/me'),
      ]);
      setProspects(prospectResponse.data);
      setActivities(activityResponse.data);
      setConfig(configResponse.data);
      setSummary(summaryResponse.data);
      setTeam(teamResponse.data);
      setCurrentUser(meResponse.data);
      setSelectedId((current) => current && prospectResponse.data.some((item) => item.id === current) ? current : prospectResponse.data[0]?.id ?? null);
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível carregar a prospecção.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleProspects = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const currentUserIsSeller = Boolean(currentUser && config?.campaign.seller_ids.includes(currentUser.id));
    return prospects.filter((prospect) => {
      const active = ['new', 'approved', 'contacted', 'interested', 'emailing', 'replied'].includes(prospect.status);
      const owned = !currentUserIsSeller || prospect.assigned_to_id === currentUser?.id;
      const matchesView = view !== 'queue' || (active && owned);
      const matchesSearch = !normalized || `${companyName(prospect)} ${prospect.company_name} ${prospect.cnpj} ${prospect.segment}`.toLowerCase().includes(normalized);
      return matchesView && matchesSearch;
    });
  }, [config?.campaign.seller_ids, currentUser, prospects, search, view]);

  const selected = visibleProspects.find((item) => item.id === selectedId) ?? visibleProspects[0] ?? null;
  const inbound = activities.filter((item) => item.direction === 'inbound');
  const currentUserIsSeller = Boolean(currentUser && config?.campaign.seller_ids.includes(currentUser.id));
  const queueCount = prospects.filter((item) => ['new', 'approved', 'contacted', 'interested', 'emailing', 'replied'].includes(item.status) && (!currentUserIsSeller || item.assigned_to_id === currentUser?.id)).length;

  async function runAction(label: string, request: () => Promise<any>, success: (data: any) => string) {
    setWorking(label);
    try {
      const { data } = await request();
      toast.success(success(data));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível concluir a ação.'));
    } finally {
      setWorking('');
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    await runAction('import', () => api.post('/prospecting/import', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }), (data) => `${data.added} empresas importadas; ${data.skipped} ignoradas.`);
    if (fileRef.current) fileRef.current.value = '';
  }

  const tabs: { id: View; label: string; icon: JSX.Element; count?: number }[] = [
    { id: 'queue', label: 'Fila de hoje', icon: <Target size={14} />, count: queueCount },
    { id: 'all', label: 'Todas', icon: <Building2 size={14} />, count: prospects.length },
    { id: 'conversations', label: 'Conversas', icon: <Inbox size={14} />, count: inbound.length },
    { id: 'settings', label: 'Configurações', icon: <Settings2 size={14} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Prospecção"
        description="Empresas novas, abordagem consultiva e conversão para o pipeline."
        aiModule="Prospecção comercial"
        aiContext="Analise metas, aderência dos prospectos e retornos da campanha."
        action={(
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
            <Button aria-label="Importar base de prospectos" size="sm" variant="secondary" loading={working === 'import'} onClick={() => fileRef.current?.click()} icon={<FileSpreadsheet size={14} />}><span className="hidden sm:inline">Importar base</span></Button>
            <Button size="sm" loading={working === 'discover'} disabled={!config?.source.configured} onClick={() => runAction('discover', () => api.post('/prospecting/discover?limit=45', undefined, { timeout: 60000 }), (data) => `${data.added} novas empresas qualificadas.`)} icon={<Search size={14} />}>Buscar empresas</Button>
          </div>
        )}
      />

      {summary ? <SummaryStrip summary={summary} /> : null}

      {config && (!config.source.configured || !config.email.configured || !config.scheduler) ? (
        <div className="flex items-start gap-3 rounded-xl border px-4 py-3 text-xs leading-relaxed" style={{ borderColor: '#fed7aa', background: '#fffbeb', color: '#92400e' }}>
          <CircleDollarSign size={16} className="mt-0.5 shrink-0" />
          <span>{!config.source.configured ? 'A chave da Casa dos Dados ainda não foi configurada; use Importar base por enquanto. ' : ''}{!config.email.configured ? 'A Hostinger ainda não está conectada. ' : ''}{!config.scheduler ? 'A rotina automática ainda não possui segredo.' : ''}</span>
        </div>
      ) : null}

      <nav className="flex gap-1 overflow-x-auto rounded-xl border bg-white p-1" style={{ borderColor: 'var(--erp-border)' }} aria-label="Áreas da prospecção">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setView(tab.id)} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors" style={{ background: view === tab.id ? 'var(--erp-violet)' : 'transparent', color: view === tab.id ? '#fff' : 'var(--erp-text-muted)' }}>
            {tab.icon}{tab.label}{tab.count != null ? <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{tab.count}</span> : null}
          </button>
        ))}
        <Button size="xs" variant="ghost" className="ml-auto shrink-0" loading={working === 'sync'} disabled={!config?.email.configured} onClick={() => runAction('sync', () => api.post('/prospecting/inbox/sync', undefined, { timeout: 60000 }), (data) => data.added ? `${data.added} resposta(s) sincronizada(s).` : 'Caixa atualizada; nenhuma resposta nova.')} icon={<RefreshCw size={13} />}>Sincronizar</Button>
      </nav>

      {view === 'settings' && config ? <SettingsView config={config} team={team} onSaved={load} /> : null}

      {view === 'conversations' ? (
        <Card padding="sm">
          {inbound.length ? <div className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>{inbound.map((activity) => {
            const prospect = prospects.find((item) => item.id === activity.prospect_id);
            return (
              <button key={activity.id} type="button" onClick={() => { setSelectedId(activity.prospect_id); setView('all'); }} className="flex w-full items-start gap-3 px-2 py-3 text-left hover:bg-[var(--erp-surface-2)]" style={{ borderColor: 'var(--erp-border)' }}>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: '#ecfdf5', color: 'var(--erp-emerald)' }}><Mail size={15} /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm" style={{ color: 'var(--erp-text)' }}>{prospect ? companyName(prospect) : 'Empresa não identificada'}</strong><span className="shrink-0 text-[11px]" style={{ color: 'var(--erp-text-dim)' }}>{formatDateTime(activity.occurred_at)}</span></span><span className="mt-0.5 block truncate text-xs font-medium" style={{ color: 'var(--erp-text-muted)' }}>{activity.subject || 'Resposta por e-mail'}</span><span className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{activity.body}</span></span>
              </button>
            );
          })}</div> : <EmptyState icon={<Inbox size={20} />} title="Nenhuma resposta sincronizada" description="Quando uma empresa responder ao e-mail comercial, a conversa aparecerá aqui e os lembretes serão interrompidos." />}
        </Card>
      ) : null}

      {(view === 'queue' || view === 'all') ? (
        <section className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: 'var(--erp-border)' }}>
          <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4" style={{ borderColor: 'var(--erp-border)' }}>
            <div><h2 className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>{view === 'queue' ? 'Prioridades comerciais' : 'Empresas prospectadas'}</h2><p className="mt-0.5 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{view === 'queue' ? 'Revise, ligue e registre o resultado sem sair da tela.' : 'Histórico completo, incluindo convertidas e bloqueadas.'}</p></div>
            <div className="relative w-full sm:w-72"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--erp-text-dim)' }} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Empresa, CNPJ ou segmento" className={`${inputClass} pl-9`} style={{ background: 'var(--erp-surface-2)', borderColor: 'var(--erp-border)', color: 'var(--erp-text)' }} /></div>
          </div>
          {loading ? (
            <div className="grid min-h-80 place-items-center"><span className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Carregando prospecção...</span></div>
          ) : visibleProspects.length ? (
            <div className="grid lg:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)]">
              <div className="max-h-[760px] overflow-y-auto">{visibleProspects.map((prospect) => <ProspectRow key={prospect.id} prospect={prospect} selected={prospect.id === selectedId} onSelect={() => setSelectedId(prospect.id)} />)}</div>
              {selected ? <ProspectDetail prospect={selected} activities={activities} config={config!} onRefresh={load} /> : null}
            </div>
          ) : <EmptyState icon={<Users size={20} />} title={search ? 'Nenhuma empresa encontrada' : 'A fila está pronta para receber empresas'} description={search ? 'Revise a busca ou veja a lista completa.' : 'Configure a Casa dos Dados ou importe uma planilha. O sistema qualificará e distribuirá cinco empresas para cada comercial.'} action={!search && config?.source.configured ? { label: 'Buscar empresas agora', onClick: () => void runAction('discover', () => api.post('/prospecting/discover?limit=45'), (data) => `${data.added} novas empresas qualificadas.`) } : undefined} />}
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--erp-text-muted)' }}><ShieldCheck size={13} />Dados públicos usados somente para prospecção B2B relevante. Descadastros entram na lista permanente de não contato. <a className="font-semibold underline" href={config?.privacy_url || 'https://4core.site/privacidade'} target="_blank" rel="noreferrer">Política de privacidade</a></p>
    </div>
  );
}
