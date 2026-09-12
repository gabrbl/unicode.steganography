import { describe, expect, it } from 'vitest';
import { assessPassword } from '../password-strength';

describe('assessPassword', () => {
  it('trata la contraseña vacía como ausencia de contraseña', () => {
    const assessment = assessPassword('');
    expect(assessment.level).toBe('empty');
    expect(assessment.bits).toBe(0);
  });

  it('escala la entropía con la longitud y la variedad', () => {
    const corta = assessPassword('abc');
    const larga = assessPassword('abcdefghijklm');
    const variada = assessPassword('Abc1!defghijk');

    expect(larga.bits).toBeGreaterThan(corta.bits);
    expect(variada.bits).toBeGreaterThan(larga.bits);
  });

  it('penaliza la repetición: ocho letras iguales no valen por ocho', () => {
    expect(assessPassword('aaaaaaaa').bits).toBeLessThan(assessPassword('abcdefgh').bits);
  });

  it('clasifica de débil a excelente según los bits', () => {
    expect(assessPassword('hola').level).toBe('weak');
    expect(assessPassword('correcto-caballo-batería-grapa-2026!').level).toBe('excellent');
  });

  it('da un tiempo de ataque legible en ambos extremos', () => {
    expect(assessPassword('1234').crackTime).toMatch(/instant|s$|min/);
    expect(assessPassword('correcto-caballo-batería-grapa-2026!').crackTime).toMatch(
      /años|universo/,
    );
  });
});
