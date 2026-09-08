import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Filtre de bruit console. Un filtre trop large est pire que pas de filtre :
 * il avalerait les avertissements de l'application. Les tests portent donc
 * autant sur ce qui est BLOQUE que sur ce qui doit PASSER.
 *
 * Le module agit par effet de bord a l'import : on capture les originaux
 * AVANT de l'importer.
 */
const original = { log: console.log, info: console.info, warn: console.warn };
const vus = { log: [], info: [], warn: [] };

beforeAll(async () => {
  console.log = (...a) => vus.log.push(a);
  console.info = (...a) => vus.info.push(a);
  console.warn = (...a) => vus.warn.push(a);
  await import('./silenceThreeContextLog');
});

afterAll(() => {
  console.log = original.log;
  console.info = original.info;
  console.warn = original.warn;
});

describe('bruit filtre', () => {
  it('avale la perte et la restauration de contexte WebGL', () => {
    vus.log.length = 0;
    console.log('THREE.WebGLRenderer: Context Lost.');
    console.log('THREE.WebGLRenderer: Context Restored.');
    expect(vus.log).toHaveLength(0);
  });

  it('avale la depreciation de THREE.Clock', () => {
    // Interne a @react-three/fiber : rien a corriger cote application.
    vus.warn.length = 0;
    console.warn('THREE.Clock: This module has been deprecated. Use ... instead.');
    expect(vus.warn).toHaveLength(0);
  });

  it('avale la publicite locize d i18next', () => {
    vus.info.length = 0;
    console.info('i18next::translator: you should consider locize.com');
    expect(vus.info).toHaveLength(0);
  });
});

describe('ce qui doit continuer a passer', () => {
  it('laisse passer tous les autres messages', () => {
    vus.log.length = 0; vus.warn.length = 0; vus.info.length = 0;
    console.log('THREE.WebGLRenderer: something else entirely');
    console.warn('React does not recognize the prop');
    console.info('i18next initialise');   // i18next sans locize : on garde
    expect(vus.log).toHaveLength(1);
    expect(vus.warn).toHaveLength(1);
    expect(vus.info).toHaveLength(1);
  });

  it('ne filtre QUE sur un prefixe, pas sur une occurrence au milieu', () => {
    // Un message applicatif qui CITE le texte filtre doit rester visible.
    vus.log.length = 0;
    console.log('Erreur inattendue : THREE.WebGLRenderer: Context Lost.');
    expect(vus.log).toHaveLength(1);
  });

  it('laisse passer un premier argument non textuel', () => {
    vus.log.length = 0; vus.warn.length = 0;
    console.log({ objet: true }, 'suite');
    console.warn(new Error('boum'));
    expect(vus.log).toHaveLength(1);
    expect(vus.warn).toHaveLength(1);
  });

  it('transmet TOUS les arguments, pas seulement le premier', () => {
    vus.log.length = 0;
    console.log('message', 1, { a: 2 });
    expect(vus.log[0]).toEqual(['message', 1, { a: 2 }]);
  });

  it('n avale rien sans argument', () => {
    vus.log.length = 0;
    console.log();
    expect(vus.log).toHaveLength(1);
  });
});
