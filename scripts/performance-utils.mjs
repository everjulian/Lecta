export function percentile(values, percentileValue) {
  if (values.length === 0) throw new Error('Cannot calculate a percentile without samples');
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

export function summarize(values) {
  return {
    samples: values.length,
    p50: round(percentile(values, 50)),
    p95: round(percentile(values, 95)),
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
  };
}

export function syntheticSentence(index) {
  const topics = [
    'arquitectura hexagonal',
    'contratos de aplicación',
    'persistencia local',
    'pruebas deterministas',
    'diseño de interfaces',
    'seguridad de Electron',
    'procesamiento de audio',
    'búsqueda de conocimiento',
  ];
  const topic = topics[index % topics.length];
  return `Fixture sintético ${index}: análisis reproducible sobre ${topic} sin datos personales.`;
}

export function round(value) {
  return Math.round(value * 100) / 100;
}
