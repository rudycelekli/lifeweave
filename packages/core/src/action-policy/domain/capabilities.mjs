import { DAY, HOUR } from '../../shared/time.mjs';

export const OBSERVATION_POLICIES = Object.freeze({
  'mail.message': Object.freeze({ scope: 'mail.read', maxAgeMs: 14 * DAY }),
  'mail.commitment': Object.freeze({ scope: 'mail.read', maxAgeMs: 14 * DAY }),
  'calendar.event': Object.freeze({ scope: 'calendar.read', maxAgeMs: 48 * HOUR }),
  'calendar.availability': Object.freeze({ scope: 'calendar.read', maxAgeMs: 48 * HOUR }),
  'health.sleep': Object.freeze({ scope: 'health.sleep.read', maxAgeMs: 7 * DAY }),
  'relationship.contact': Object.freeze({ scope: 'contacts.read', maxAgeMs: 90 * DAY }),
  'metric.update': Object.freeze({ scope: 'manual.read', maxAgeMs: 30 * DAY }),
  'manual.note': Object.freeze({ scope: 'manual.read', maxAgeMs: 30 * DAY })
});
export const ACTION_CAPABILITIES = Object.freeze(['mail.send', 'calendar.write', 'contacts.write', 'computer.use']);
export const CONNECTOR_CATALOG = Object.freeze([
  { id: 'manual', provider: 'manual-import', availability: 'implemented', mode: 'local-json', status: 'disconnected', readScopes: ['manual.read', 'mail.read', 'calendar.read', 'health.sleep.read', 'contacts.read'], writeScopes: [], description: 'Consent-checked local JSON observation import. No remote access.' },
  { id: 'gmail', provider: 'google', availability: 'configuration-required', mode: 'oauth', status: 'disconnected', readScopes: ['mail.read'], writeScopes: ['mail.send'], description: 'Integration contract only. No OAuth or network adapter is implemented in core.' },
  { id: 'outlook', provider: 'microsoft', availability: 'configuration-required', mode: 'oauth', status: 'disconnected', readScopes: ['mail.read', 'calendar.read', 'contacts.read'], writeScopes: ['mail.send', 'calendar.write'], description: 'Integration contract only. No OAuth or network adapter is implemented in core.' },
  { id: 'google-calendar', provider: 'google', availability: 'configuration-required', mode: 'oauth', status: 'disconnected', readScopes: ['calendar.read'], writeScopes: ['calendar.write'], description: 'Integration contract only. No OAuth or network adapter is implemented in core.' },
  { id: 'health-export', provider: 'health-export', availability: 'implemented', mode: 'local-json', status: 'disconnected', readScopes: ['health.sleep.read'], writeScopes: [], description: 'Explicitly consented normalized sleep import; raw Apple Health ZIP/XML ingestion is not implemented.' },
  { id: 'computer-use', provider: 'host-agent', availability: 'configuration-required', mode: 'host-mediated', status: 'disconnected', readScopes: [], writeScopes: ['computer.use'], description: 'No desktop controller. Host must implement per-action approval and execution.' }
].map((entry) => Object.freeze({ ...entry, readScopes: Object.freeze(entry.readScopes), writeScopes: Object.freeze(entry.writeScopes) })));
