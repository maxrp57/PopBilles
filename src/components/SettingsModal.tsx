import React, { useRef, useState } from 'react';
import { Download, Trash2, Upload, Volume2, VolumeX, X, Music } from 'lucide-react';
import { PlayerSettings, SaveData } from '../types/game';
import { exportSaveDataJson } from '../utils/storage';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: PlayerSettings;
  saveData: SaveData;
  onUpdateSettings: (next: PlayerSettings) => void;
  onImportSave: (json: string) => { ok: boolean; error?: string };
  onResetAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  settings,
  saveData,
  onUpdateSettings,
  onImportSave,
  onResetAllData,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  if (!open) return null;

  const handleExport = () => {
    const json = exportSaveDataJson(saveData);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popbilles-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ type: 'ok', msg: 'Sauvegarde exportée en fichier JSON.' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const res = onImportSave(reader.result);
        if (res.ok) {
          setFeedback({ type: 'ok', msg: 'Sauvegarde restaurée avec succès !' });
        } else {
          setFeedback({ type: 'err', msg: res.error || 'Fichier invalide.' });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Paramètres"
    >
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-xl font-bold text-slate-900">Paramètres & Sauvegarde</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-stone-100 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Sound Effects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {settings.sfxEnabled ? (
                  <Volume2 className="w-4 h-4 text-amber-600" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                <span className="font-semibold text-sm text-slate-900">Effets sonores</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, sfxEnabled: !settings.sfxEnabled })
                }
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  settings.sfxEnabled
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-100 text-slate-600'
                }`}
              >
                {settings.sfxEnabled ? 'Activés' : 'Coupés'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              disabled={!settings.sfxEnabled}
              onChange={(e) =>
                onUpdateSettings({ ...settings, sfxVolume: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
              aria-label="Volume des effets sonores"
            />
          </div>

          {/* Ambient Music */}
          <div className="space-y-3 pt-4 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Music className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-sm text-slate-900">Musique d’ambiance</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, musicEnabled: !settings.musicEnabled })
                }
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  settings.musicEnabled
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-100 text-slate-600'
                }`}
              >
                {settings.musicEnabled ? 'Activée' : 'Coupée'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              disabled={!settings.musicEnabled}
              onChange={(e) =>
                onUpdateSettings({ ...settings, musicVolume: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
              aria-label="Volume de la musique"
            />
          </div>

          {/* Gameplay & Visual Preferences */}
          <div className="space-y-3 pt-4 border-t border-stone-100">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-slate-900">Ligne de visée</div>
                <div className="text-xs text-slate-500">
                  Affiche un repère vertical sous la bille à lancer
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.showTrajectory}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, showTrajectory: e.target.checked })
                }
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-slate-900">Réduire les secousses & particules</div>
                <div className="text-xs text-slate-500">
                  Désactive les secousses d’écran et limite les effets de fusion
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.reducedEffects}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, reducedEffects: e.target.checked })
                }
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Save Data Management */}
          <div className="pt-4 border-t border-stone-100 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Données locales (sans compte)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Votre progression est enregistrée automatiquement sur cet appareil. Exportez un fichier pour la transférer ailleurs.
              </p>
            </div>

            {feedback && (
              <div
                className={`px-3 py-2 rounded-xl text-xs font-medium ${
                  feedback.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {feedback.msg}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Exporter (.json)
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Importer (.json)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="pt-2">
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Effacer toutes les données locales
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-red-800">
                    Supprimer scores, boutique et collection ?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-2.5 py-1 rounded-lg bg-white text-slate-700 text-xs font-semibold border border-stone-200 cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onResetAllData();
                        setConfirmReset(false);
                        setFeedback({ type: 'ok', msg: 'Toutes les données ont été réinitialisées.' });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Confirmer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
