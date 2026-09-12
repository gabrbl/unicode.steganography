import { StegoApp } from '@/components/stego-app';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-[11px] tracking-[0.16em] text-muted uppercase transition-colors hover:text-text">
        <span className="mr-2 text-phosphor-dim group-open:hidden">▶</span>
        <span className="mr-2 hidden text-phosphor-dim group-open:inline">▼</span>
        {title}
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-4 text-xs leading-relaxed text-muted">
        {children}
      </div>
    </details>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-lg tracking-[0.18em] text-phosphor uppercase sm:text-xl">
          <span className="mr-2 text-phosphor-dim">▚</span>
          Esteganografía Unicode
          <span className="caret ml-1" aria-hidden />
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Esconde un mensaje dentro de otro. El texto que obtienes se ve exactamente igual que el
          que escribiste, pero arrastra caracteres invisibles que solo esta herramienta sabe leer.
        </p>
        <p className="text-[11px] text-dim">
          Todo ocurre en tu navegador. Ni el secreto ni la contraseña se envían a ningún servidor.
        </p>
      </header>

      <StegoApp />

      <Section title="cómo funciona">
        <p>
          Unicode define 256 <em>variation selectors</em>, repartidos entre{' '}
          <code className="text-cyan">U+FE00..U+FE0F</code> y{' '}
          <code className="text-cyan">U+E0100..U+E01EF</code>. Su función original es elegir entre
          variantes gráficas de un mismo carácter, y cuando el sistema no reconoce la combinación
          simplemente no dibuja nada.
        </p>
        <p>
          Como son exactamente 256, cada uno puede representar un valor de byte. El mensaje se
          convierte en una cadena de selectores que se adosa al último carácter del texto visible:
          invisible al ojo, intacto al copiar y pegar.
        </p>
        <p>
          Con contraseña, el secreto se cifra antes con <strong>AES-256-GCM</strong> y una clave
          derivada mediante <strong>PBKDF2-HMAC-SHA256</strong> con 600.000 iteraciones, el mínimo
          que recomienda OWASP. El cifrado es autenticado: una contraseña incorrecta o un texto
          manipulado fallan de forma limpia en lugar de devolver basura.
        </p>
      </Section>

      <Section title="hasta dónde llega esto">
        <p>
          <strong className="text-amber">El criptograma viaja en público.</strong> Quien reciba el
          mensaje tiene todo lo necesario para atacarlo sin conexión y sin límite de intentos. Lo
          único que lo frena es el coste de derivar la clave, así que la contraseña es la defensa
          real: una palabra del diccionario cae en minutos por muchas iteraciones que pongamos.
        </p>
        <p>
          <strong className="text-amber">No todas las plataformas lo respetan.</strong> La técnica
          sobrevive bien al copiar y pegar, a los documentos y a la mayoría de mensajería, pero
          algunos formularios, saneadores y clientes de correo normalizan el texto y se llevan por
          delante los selectores. Prueba en el destino real antes de confiar en ello.
        </p>
        <p>
          <strong className="text-amber">Es ocultación, no invisibilidad.</strong> Cualquiera que
          sospeche puede detectar los caracteres y, si no hay contraseña, leer el mensaje. La
          esteganografía esconde que hay un mensaje; solo el cifrado protege su contenido.
        </p>
      </Section>

      <footer className="border-t border-line pt-4 text-[11px] text-dim">
        Construido con Next.js y WebCrypto. Sin dependencias criptográficas de terceros.
      </footer>
    </main>
  );
}
