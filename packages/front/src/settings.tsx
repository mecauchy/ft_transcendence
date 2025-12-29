// settings.tsx
import {useState, useEffect} from 'react';
import {api} from './api/client';
import type {ApiError} from './api/client';
import {useAuth} from './contexts/AuthContext';

function Settings() {
    const {user} = useAuth();  // Get logged-in user info
    
    // State for settings data
    const [settings, setSettings] = useState<{
        avatar?: string;
        colour?: string;
        locale: string;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // ========== FETCH DATA ON LOAD ==========
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await api.getSettings();  // ← Call API
                setSettings(data);
            } catch (err) {
                const apiError = err as ApiError;
                setError(apiError.message || 'Failed to load settings');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, []);

    // ========== UPDATE DATA ==========
    const handleSave = async () => {
        if (!settings) return;
        
        setIsSaving(true);
        setError('');
        try {
            await api.updateSettings(settings);  // ← Call API
            alert('Settings saved!');
        } catch (err) {
            const apiError = err as ApiError;
            setError(apiError.message || 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    // ========== RENDER ==========
    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className="settings_container">
            <h1>Settings</h1>
            
            <label>
                Language:
                <select 
                    value={settings?.locale || 'en'} 
                    onChange={(e) => setSettings({...settings!, locale: e.target.value})}
                >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                </select>
            </label>

            <button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
        </div>
    );
}

export default Settings;