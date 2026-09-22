import './style.css';
import './ui/combat.css';
import './ui/loading.css';
import './ui/fullscreen.css';
import { LoadingScreen } from './ui/LoadingScreen';

const loading = new LoadingScreen();
loading.show('正在載入江湖引擎');

async function boot(): Promise<void> {
  if (new URLSearchParams(location.search).get('preview') === 'styles') {
    const { StyleComparison } = await import('./dev/StyleComparison');
    const preview = new StyleComparison();
    import.meta.hot?.dispose(() => preview.dispose());
    await preview.init((progress) => loading.show('正在準備女俠風格比較', progress));
    loading.hide();
    return;
  }
  if (new URLSearchParams(location.search).get('preview') === 'legacy') {
    const { LegacyPreview } = await import('./dev/LegacyPreview');
    const preview = new LegacyPreview();
    import.meta.hot?.dispose(() => preview.dispose());
    await preview.init((progress) => loading.show('正在載入原版角色', progress));
    loading.hide();
    return;
  }
  if (new URLSearchParams(location.search).get('preview') === 'spine') {
    const { SpinePreview } = await import('./dev/SpinePreview');
    const preview = new SpinePreview();
    import.meta.hot?.dispose(() => preview.dispose());
    await preview.init((progress) => loading.show('正在載入 Spine 角色素材', progress));
    loading.hide();
    return;
  }
  if (new URLSearchParams(location.search).get('preview') === 'injuries') {
    const { InjuryPreview } = await import('./dev/InjuryPreview');
    const preview = new InjuryPreview();
    await preview.init();
    loading.hide();
    import.meta.hot?.dispose(() => preview.dispose());
    return;
  }
  const [{ GameApplication }, { SaveRepository }, { AssetService }, { SettingsRepository }] =
    await Promise.all([
      import('./app/GameApplication'),
      import('./services/SaveRepository'),
      import('./services/AssetService'),
      import('./services/SettingsRepository'),
    ]);
  // 停用本機儲存的瀏覽器仍可遊玩與匯出，所以延後到真正讀寫時才取得 localStorage。
  const storage = {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => localStorage.setItem(key, value),
  };
  const saves = new SaveRepository(storage);
  const game = new GameApplication(
    saves,
    AssetService.create(import.meta.env.BASE_URL),
    loading,
    new SettingsRepository(storage),
  );
  await game.init();
  import.meta.hot?.dispose(() => game.dispose());
}

void boot().catch(async (error: unknown) => {
  console.error(error);
  loading.show('江湖畫卷未能展開');
  if (await loading.askRetry(new Error('請確認網路與瀏覽器 WebGL 支援後重新載入。'), false)) {
    location.reload();
  }
});
