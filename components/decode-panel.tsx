'use client';

import { useMemo, useState } from 'react';
import { Badge, Callout } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { OUTPUT_CONTROL, PasswordField, TextAreaField, TRAILING_BUTTON } from '@/components/ui/field';
import { PasteButton } from '@/components/ui/paste-button';
import { inspect, reveal, revealPlain, type RevealResult } from '@/lib/stego';

function DetectionBanner({ input }: { input: string }) {
  const info = useMemo(() => inspect(input), [input]);

  if (input.length === 0) return null;

  if (!info) {
    return <Callout tone="neutral">No se ha detectado ningún mensaje oculto en este texto.</Callout>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="phosphor">carga detectada</Badge>
      <Badge tone={info.encrypted ? 'cyan' : 'amber'}>
        {info.encrypted ? 'AES-256-GCM' : 'sin cifrar'}
      </Badge>
      <span className="text-[11px] text-dim">{info.payloadBytes} bytes ocultos</span>
    </div>
  );
}

function Result({ result }: { result: RevealResult }) {
  switch (result.status) {
    case 'none':
      return null;

    case 'password-required':
      return (
        <Callout tone="cyan">
          El mensaje está cifrado. Introduce la contraseña para descifrarlo.
        </Callout>
      );

    case 'wrong-password':
      return (
        <Callout tone="danger">
          Contraseña incorrecta, o el texto ha sido alterado desde que se generó. AES-GCM verifica
          la integridad, así que no hay forma de saber cuál de las dos cosas ha pasado.
        </Callout>
      );

    case 'corrupt':
      return (
        <Callout tone="danger">
          Se ha encontrado una carga oculta, pero está dañada o incompleta. Es posible que el texto
          haya pasado por algún sistema que recorta caracteres.
        </Callout>
      );

    case 'plain':
    case 'encrypted':
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] tracking-[0.16em] text-muted uppercase">
              <span className="mr-1.5 text-phosphor-dim">$</span>mensaje oculto
            </span>
            <Badge tone={result.status === 'encrypted' ? 'phosphor' : 'amber'}>
              {result.status === 'encrypted' ? 'descifrado' : 'estaba en claro'}
            </Badge>
          </div>

          <textarea
            readOnly
            rows={4}
            value={result.secret}
            onFocus={(event) => event.target.select()}
            className={OUTPUT_CONTROL}
          />

          <div>
            <CopyButton value={result.secret} />
          </div>
        </div>
      );
  }
}

export function DecodePanel() {
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // El resultado descifrado se guarda junto al texto que lo produjo. Así queda
  // obsoleto solo, en cuanto el usuario toca el textarea, sin necesidad de un
  // efecto que lo limpie y provoque un render en cascada.
  const [decrypted, setDecrypted] = useState<{ input: string; result: RevealResult } | null>(null);

  const info = useMemo(() => inspect(input), [input]);
  // Lo que no necesita contraseña se resuelve durante el render.
  const withoutPassword = useMemo(() => revealPlain(input), [input]);

  const result = decrypted?.input === input ? decrypted.result : withoutPassword;

  async function onReveal() {
    setBusy(true);
    try {
      setDecrypted({ input, result: await reveal(input, password) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <TextAreaField
        label="texto a examinar"
        rows={4}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Pega aquí el texto que crees que esconde algo"
        hint="Se analiza mientras escribes. Nada sale de tu navegador."
        // El payload viaja en caracteres invisibles: la autocorrección y la
        // puntuación inteligente de iOS podrían alterarlo al seguir escribiendo.
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        trailing={
          <span className="flex items-center gap-2">
            <PasteButton onPaste={setInput} />
            {input.length > 0 ? (
              <button type="button" onClick={() => setInput('')} className={TRAILING_BUTTON}>
                limpiar
              </button>
            ) : null}
          </span>
        }
      />

      <DetectionBanner input={input} />

      {info?.encrypted ? (
        <div className="flex flex-col gap-4">
          <PasswordField
            label="contraseña"
            value={password}
            onChange={setPassword}
            placeholder="La contraseña con la que se cifró"
          />
          <div>
            <Button onClick={onReveal} disabled={busy || password.length === 0}>
              {busy ? 'derivando clave…' : 'revelar'}
            </Button>
          </div>
        </div>
      ) : null}

      <div aria-live="polite">
        <Result result={result} />
      </div>
    </div>
  );
}
