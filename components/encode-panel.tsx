'use client';

import { useMemo, useState } from 'react';
import { Badge, Callout } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { PasswordField, TextAreaField } from '@/components/ui/field';
import { HexDump } from '@/components/hex-dump';
import { cn } from '@/lib/cn';
import { assessPassword, type StrengthLevel } from '@/lib/password-strength';
import { hide } from '@/lib/stego';
import { bytesToSelectors } from '@/lib/variation-selectors';

const encoder = new TextEncoder();

interface Output {
  text: string;
  payload: Uint8Array;
  encrypted: boolean;
  secretBytes: number;
}

const STRENGTH_STYLES: Record<StrengthLevel, { bar: string; text: string; width: string }> = {
  empty: { bar: 'bg-line', text: 'text-dim', width: '0%' },
  weak: { bar: 'bg-danger', text: 'text-danger', width: '25%' },
  fair: { bar: 'bg-amber', text: 'text-amber', width: '50%' },
  strong: { bar: 'bg-phosphor-dim', text: 'text-phosphor', width: '75%' },
  excellent: { bar: 'bg-phosphor', text: 'text-phosphor', width: '100%' },
};

function StrengthMeter({ password }: { password: string }) {
  const assessment = useMemo(() => assessPassword(password), [password]);
  const style = STRENGTH_STYLES[assessment.level];

  if (assessment.level === 'empty') return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-0.5 w-full bg-line">
        <div
          className={cn('h-full transition-all duration-300', style.bar)}
          style={{ width: style.width }}
        />
      </div>
      <p className="text-[11px] text-dim">
        <span className={style.text}>{assessment.label}</span>
        <span className="mx-1.5 text-line-bright">·</span>~{assessment.bits} bits
        <span className="mx-1.5 text-line-bright">·</span>
        fuerza bruta con GPU: {assessment.crackTime}
      </p>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border border-line bg-surface px-3 py-2">
      <dt className="text-[11px] tracking-[0.14em] text-dim uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-text">
        {value}
        {detail ? <span className="ml-1 text-[11px] text-dim">{detail}</span> : null}
      </dd>
    </div>
  );
}

export function EncodePanel() {
  const [visibleText, setVisibleText] = useState('');
  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [output, setOutput] = useState<Output | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = secret.length > 0 && !busy;

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const result = await hide({ visibleText, secret, password });
      setOutput({ ...result, secretBytes: encoder.encode(secret).length });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar el mensaje');
      setOutput(null);
    } finally {
      setBusy(false);
    }
  }

  const invisibleWeight = output ? encoder.encode(bytesToSelectors(output.payload)).length : 0;

  return (
    <div className="flex flex-col gap-6">
      <TextAreaField
        label="mensaje visible"
        rows={3}
        value={visibleText}
        onChange={(event) => setVisibleText(event.target.value)}
        placeholder="Lo que cualquiera verá al leer el texto"
        hint="Si lo dejas vacío se usará un único carácter como portador."
      />

      <TextAreaField
        label="mensaje oculto"
        rows={4}
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        placeholder="Lo que quedará escondido entre los caracteres invisibles"
        trailing={
          <span className="text-[11px] text-dim">{encoder.encode(secret).length} bytes</span>
        }
      />

      <div className="flex flex-col gap-2">
        <PasswordField
          label="contraseña (opcional)"
          value={password}
          onChange={setPassword}
          placeholder="Sin contraseña el mensaje viaja en claro"
        />
        <StrengthMeter password={password} />
      </div>

      {password.length === 0 ? (
        <Callout tone="amber">
          Sin contraseña el mensaje oculto va <strong>en claro</strong>: cualquiera que sospeche y
          pase el texto por esta herramienta lo leerá.
        </Callout>
      ) : (
        <Callout tone="phosphor">
          Se cifrará con AES-256-GCM y una clave derivada con PBKDF2-SHA256 (600.000 iteraciones).
          Si pierdes la contraseña no hay forma de recuperar el mensaje.
        </Callout>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {busy ? 'derivando clave…' : 'generar'}
        </Button>
        {secret.length === 0 ? (
          <span className="text-[11px] text-dim">Escribe algo que ocultar para continuar.</span>
        ) : null}
      </div>

      <div aria-live="polite" className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}

        {output ? (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] tracking-[0.16em] text-muted uppercase">
                  <span className="mr-1.5 text-phosphor-dim">$</span>resultado
                </span>
                <Badge tone={output.encrypted ? 'phosphor' : 'amber'}>
                  {output.encrypted ? 'AES-256-GCM' : 'sin cifrar'}
                </Badge>
              </div>

              <textarea
                readOnly
                rows={3}
                value={output.text}
                onFocus={(event) => event.target.select()}
                className="w-full resize-y border border-phosphor-dim bg-raised px-3 py-2.5 text-sm leading-relaxed text-text"
              />

              <div className="flex flex-wrap items-center gap-3">
                <CopyButton value={output.text} />
                <span className="text-[11px] text-dim">
                  Parece idéntico al mensaje visible. Pégalo donde quieras.
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="secreto" value={`${output.secretBytes} B`} />
              <Metric
                label="carga"
                value={`${output.payload.length} B`}
                detail={output.encrypted ? '(+46)' : undefined}
              />
              <Metric label="total" value={`${[...output.text].length}`} detail="caracteres" />
              <Metric label="peso invisible" value={`${invisibleWeight} B`} detail="UTF-8" />
            </dl>

            <HexDump bytes={output.payload} encrypted={output.encrypted} />
          </>
        ) : null}
      </div>
    </div>
  );
}
