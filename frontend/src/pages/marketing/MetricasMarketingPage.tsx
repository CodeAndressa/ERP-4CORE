import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Users, Heart, FileText } from 'lucide-react';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../../shared/components/ui/Card';

const WEEKLY_REACH = [
  { week: '12 mai', alcance: 2800, engajamento: 174 },
  { week: '19 mai', alcance: 3100, engajamento: 196 },
  { week: '26 mai', alcance: 2950, engajamento: 189 },
  { week: '02 jun', alcance: 3400, engajamento: 224 },
  { week: '09 jun', alcance: 3200, engajamento: 211 },
  { week: '16 jun', alcance: 3600, engajamento: 243 },
  { week: '23 jun', alcance: 3750, engajamento: 258 },
  { week: '30 jun', alcance: 4000, engajamento: 272 },
];

const CHANNEL_ENGAGEMENT = [
  { canal: 'Instagram', posts: 6, engajamento: 6.8 },
  { canal: 'LinkedIn',  posts: 3, engajamento: 4.1 },
  { canal: 'E-mail',    posts: 2, engajamento: 31.4 },
  { canal: 'Stories',   posts: 1, engajamento: 8.2 },
];

const FORMAT_BREAKDOWN = [
  { name: 'Carrossel',   value: 4 },
  { name: 'Reels',       value: 3 },
  { name: 'Newsletter',  value: 2 },
  { name: 'Artigo',      value: 2 },
  { name: 'Outros',      value: 1 },
];

const COLORS = ['#7c4dff', '#34d399', '#fbbf24', '#67e8f9', '#f87171'];

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border-strong)', color: 'var(--erp-text)' }}>
      <p className="mb-1" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function MetricasMarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Marketing</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Métricas de Marketing</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Dados dos últimos 60 dias</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Alcance Total"  value="24.800" detail="+18% vs. mês anterior" tone="violet"  icon={<TrendingUp size={16} />} trend={18}  sparkline={[22, 24, 21, 26, 28, 25, 29, 32]} />
        <MetricCard label="Engajamento"    value="6,2%"   detail="média por publicação"  tone="emerald" icon={<Heart    size={16} />} trend={4.2}  sparkline={[5, 5.8, 6, 5.5, 6.2, 6.8, 6.1, 6.4]} />
        <MetricCard label="Leads gerados"  value="18"     detail="últimos 30 dias"        tone="amber"   icon={<Users   size={16} />} trend={12.5} />
        <MetricCard label="Conteúdos"      value="12"     detail="8 publicados"           tone="cyan"    icon={<FileText size={16} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Alcance semanal */}
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader title="Alcance Semanal" subtitle="Impressões e interações" />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={WEEKLY_REACH} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gReach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c4dff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c4dff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gEngaj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<Tip />} />
              <Area name="Alcance"     type="monotone" dataKey="alcance"     stroke="#7c4dff" strokeWidth={2} fill="url(#gReach)" />
              <Area name="Engajamento" type="monotone" dataKey="engajamento" stroke="#34d399" strokeWidth={2} fill="url(#gEngaj)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Format breakdown */}
        <Card padding="lg">
          <CardHeader title="Formatos" subtitle="Distribuição de conteúdos" />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={FORMAT_BREAKDOWN} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                {FORMAT_BREAKDOWN.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--erp-text-muted)' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Engagement by channel */}
      <Card padding="lg">
        <CardHeader title="Engajamento por Canal" subtitle="Taxa de engajamento % e número de posts" />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={CHANNEL_ENGAGEMENT} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
            <XAxis dataKey="canal" tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<Tip />} />
            <Bar name="Engajamento %" dataKey="engajamento" fill="#7c4dff" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
