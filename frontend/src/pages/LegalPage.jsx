/**
 * Mentions légales, licences et traitement des données.
 *
 * Le site est public et porte le nom d'un institut de recherche : il doit dire
 * qui l'édite, d'où viennent les données, et ce qu'il fait du navigateur de ses
 * visiteurs. Tout ce qui est affirmé ici est vérifiable dans le code : aucun
 * cookie n'est posé, aucun outil de mesure n'est chargé, et le seul domaine
 * tiers contacté est celui de la banque d'images publiques de la NASA, sur la
 * page d'accueil uniquement.
 */
import { Container, Paper, Typography, Box, Stack } from '@mui/material';
import {
  Gavel as GavelIcon,
  Public as PublicIcon,
  Code as CodeIcon,
  Shield as ShieldIcon,
  AlternateEmail as ContactIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const GITHUB_URL = 'https://github.com/ludvdber/MCV';
const IASB_URL = 'https://www.aeronomie.be';

/** Une section : icône, titre de niveau 2, puis un ou plusieurs paragraphes. */
function Section({ icon: Icon, title, children }) {
  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
        <Icon sx={{ color: 'var(--mars-orange)', fontSize: 20 }} />
        <Typography variant="h6" component="h2" sx={{ fontSize: '1rem', letterSpacing: '0.02em' }}>
          {title}
        </Typography>
      </Box>
      <Stack spacing={1.2}>{children}</Stack>
    </Paper>
  );
}

/** Paragraphe courant de la page. */
function P({ children }) {
  return (
    <Typography sx={{ fontSize: '0.92rem', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
      {children}
    </Typography>
  );
}

/** Lien externe, ouvert dans un nouvel onglet. */
function A({ href, children }) {
  return (
    <Box component="a" href={href} target="_blank" rel="noopener noreferrer"
      sx={{ color: 'var(--cyan-accent)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
      {children}
    </Box>
  );
}

export default function LegalPage() {
  const { t } = useTranslation();

  return (
    <Container maxWidth="md" sx={{ mt: 3, mb: 6 }}>
      <Typography variant="h5" component="h1" gutterBottom>{t('legal.title')}</Typography>
      <Typography sx={{ fontSize: '0.95rem', lineHeight: 1.75, color: 'var(--text-secondary)', mb: 3 }}>
        {t('legal.intro')}
      </Typography>

      <Stack spacing={2}>
        <Section icon={GavelIcon} title={t('legal.publisher.title')}>
          <P>{t('legal.publisher.body')}</P>
          <P>{t('legal.publisher.notOfficial')}</P>
        </Section>

        <Section icon={PublicIcon} title={t('legal.data.title')}>
          <P>{t('legal.data.body')}</P>
          <P>{t('legal.data.reuse')} <A href={IASB_URL}>aeronomie.be</A></P>
          <Typography component="p" sx={{
            fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-primary)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            p: 1.5, borderRadius: 1, border: '1px solid var(--glass-border)',
            background: 'var(--bg-surface-hover)',
          }}>
            {t('legal.data.citation')}
          </Typography>
        </Section>

        <Section icon={CodeIcon} title={t('legal.code.title')}>
          <P>{t('legal.code.body')}</P>
          <P><A href={GITHUB_URL}>github.com/ludvdber/MCV</A></P>
        </Section>

        <Section icon={ShieldIcon} title={t('legal.privacy.title')}>
          <P>{t('legal.privacy.body')}</P>
          <P>{t('legal.privacy.storage')}</P>
          <P>{t('legal.privacy.nasa')}</P>
        </Section>

        <Section icon={ContactIcon} title={t('legal.contact.title')}>
          <P>{t('legal.contact.body')}</P>
        </Section>
      </Stack>

      <Typography sx={{ mt: 3, fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
        {t('legal.updated')}
      </Typography>
    </Container>
  );
}
