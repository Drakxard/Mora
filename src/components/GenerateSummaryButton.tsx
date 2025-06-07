// src/components/GenerateSummaryButton.tsx
import React, { useState } from 'react';
import Button from '../ui/Button';
import { generateSummary } from '../utils/chat';
import { SummaryResponse } from '../types';

interface GenerateSummaryButtonProps {
  model: string;
  files: File[];
  context?: string;
  onSummaryReady: (summary: SummaryResponse) => void;
}

const GenerateSummaryButton: React.FC<GenerateSummaryButtonProps> = ({
  model,
  files,
  context,
  onSummaryReady
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!model) {
      setErrorMsg('Primero, selecciona un modelo.');
      return;
    }
    if (files.length === 0) {
      setErrorMsg('No hay archivos para resumir.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const result = await generateSummary(model, files, context);
      onSummaryReady(result);
    } catch (err: any) {
      console.error('[GenerateSummaryButton] Error:', err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <Button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generando resumen…' : 'Generar resumen'}
      </Button>
      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
    </div>
  );
};

export default GenerateSummaryButton;
