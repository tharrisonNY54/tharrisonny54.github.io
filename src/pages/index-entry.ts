import { mountChrome } from '../partials';
import { boot } from '../main';
import { initHeroStage } from '../hero-morph';
import { initPanelSpy } from '../panel-spy';
import { initScan } from '../scan';
import { initConstellation } from '../constellation';

mountChrome();
boot();
initHeroStage();
initPanelSpy();
initScan();
initConstellation();
