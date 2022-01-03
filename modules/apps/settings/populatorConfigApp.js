import { MODULE } from "../../data/moduleConstants.js";

/**
 * A game settings configuration application
 * This form renders the settings defined via the game.settings.register API which have config = true
 *
 * @extends {FormApplication}
 */
export class PopulatorSettingsConfigApp extends FormApplication {
  constructor() {
    super();
    this.app = null;

    loadTemplates([
      `${MODULE.templatePath}/settings/settings.hbs`,
      `${MODULE.templatePath}/settings/new_rule_form.hbs`,

      `${MODULE.templatePartialsPath}/settings/actions.hbs`,
      `${MODULE.templatePartialsPath}/settings/dropdown_options.hbs`,
      `${MODULE.templatePartialsPath}/settings/filters.hbs`,
      `${MODULE.templatePartialsPath}/settings/settings.hbs`,
      `${MODULE.templatePartialsPath}/settings/menu.hbs`,
    ]);

    return this;
  }

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("Loot population Settings"),
      id: MODULE.appIds.lootpopulatorSettings,
      template: `${MODULE.templatePath}/settings/settings.hbs`,
      width: 720,
      height: "auto",
      tabs: [
        { navSelector: ".tabs", contentSelector: ".content", initial: "general" }
      ]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    /**
     * @param {Game} game
     */
    const gs = game.settings;

    /**
     * The settings assigned to this need a "group" that is either of these tabs.name
     */
    const data = {
      hasBetterRolltables: (typeof game.betterTables !== "undefined"),
      tabs: [
        {
          name: MODULE.settings.groups.lootpopulator.fallbacks,
          i18nName: game.i18n.localize('lsnpc.settings.menu.fallbacks'),
          class: "fas fa-cog", menus: [], settings: []
        },
        {
          name: MODULE.settings.groups.lootpopulator.creatureTypeFallbacks,
          i18nName: game.i18n.localize('lsnpc.settings.menu.creatureTypeFallbacks'),
          class: "fab fa-grunt", menus: [], settings: []
        },
        {
          name: MODULE.settings.groups.lootpopulator.currency,
          i18nName: game.i18n.localize('lsnpc.settings.menu.currency'),
          class: "fas fa-coins", menus: [], settings: []
        },
        {
          name: MODULE.settings.groups.lootpopulator.rulesets,
          i18nName: game.i18n.localize('lsnpc.settings.menu.rulesets'),
          class: "fas fa-filter", menus: [], settings: []
        },
        {
          name: MODULE.settings.groups.lootpopulator.skiplist,
          i18nName: game.i18n.localize('lsnpc.settings.menu.skiplist'),
          class: "fas fa-ban", menus: [], settings: []
        }
      ]
    };

    // Classify all settings
    for (let setting of gs.settings.values()) {
      // Only concerned about loot populator settings
      if (setting.module !== MODULE.ns) continue;

      // Exclude settings the user cannot change
      if (!game.user.isGM) continue;

      // Update setting data
      const s = duplicate(setting);
      s.name = game.i18n.localize(s.name);
      s.hint = game.i18n.localize(s.hint);
      s.value = game.settings.get(s.module, s.key);
      s.type = setting.type instanceof Function ? setting.type.name : "String";
      s.isCheckbox = setting.type === Boolean;
      s.isSelect = s.choices !== undefined;
      s.isRange = (setting.type === Number) && s.range;

      // Classify setting
      const name = s.module;
      if (name === MODULE.ns) {
        const group = s.group;
        let groupTab = data.tabs.find(tab => tab.name === group) ?? false;
        if (groupTab) {
          groupTab.settings.push(s);
        }
      }
    }

    // Return data
    return {
      systemTitle: game.system.data.title,
      data: data
    };
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  async activateListeners(html) {
    if(!this.app){
      this.app = document.getElementById(MODULE.appIds.lootpopulatorSettings);
    }

    super.activateListeners(html);
    this.onActionClick(this.app);

    html.find('.submenu button').click(this._onClickSubmenu.bind(this));
    //html.find('.actions button').click(this._onClickAction.bind(this));
    html.find('button[name="reset"]').click(this._onResetDefaults.bind(this));
  }

  /* -------------------------------------------- */

  async onActionClick(app = this.app){
    app.querySelectorAll('.actions button').forEach(async el => {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
          if(!e.target.dataset.action) return ui.notifications.error("No action found for the provided key");
        this._runAction(e);
      });
    });
  }

  /**
   * Handle activating the button to configure User Role permissions
   * @param event {Event}   The initial button click event
   * @private
   */
  _onClickSubmenu(event) {
    event.preventDefault();
    const menu = game.settings.menus.get(event.currentTarget.dataset.key);
    if (!menu) return ui.notifications.error("No submenu found for the provided key");
    const app = new menu.type();
    return app.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle button click to reset default settings
   * @param event {Event}   The initial button click event
   * @private
   */
  _onResetDefaults(event) {
    event.preventDefault();
    const resetOptions = event.currentTarget.form.querySelectorAll('.tab.active .settings-list [data-default]');
    for (let input of resetOptions) {
        if (input && input.type === "checkbox") input.checked = input.dataset.default;
        else if (input) input.value = input.dataset.default;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    event.preventDefault();
    formData = expandObject(formData)[MODULE.ns];

    /**
     * This is very specific to customRules, to get settings with an object.
     * Currently tailored towards a customFallback.
     *
     * The key could be build more generic by chaining 'name' and other fields (generic).
     * The values should be truncated.
     * */
    const targets = Object.keys(formData).filter(key => typeof formData[key] === 'object');
    for(let target of targets){
      if (formData[target].name.length != 0){
      let newObject = formData[target],
          currentObject = game.settings.get(MODULE.ns, target),
          key = newObject.name + '_' + newObject.rolltable + '_' + Math.random(),
          final = {};
        newObject.rolltableName = event.currentTarget.querySelector('select[name="lootpopulatornpc5e.customFallbacks.rolltable"] option:checked').dataset.label;

      final[key] = newObject;

      await game.settings.set(MODULE.ns, target, Object.assign(currentObject, final));
      }
      //delete the manually updated settings
      delete formData[target];
    }

    for(let [k,v] of Object.entries(formData)){
      await game.settings.set(MODULE.ns, k, v);
    }
  }

  /**
   * Validate and run a requested UI action
   *
   * @param {Event} event
   * @param {HTML} app
   *
   */
  async _runAction(event){
    switch(event.target.dataset.action) {
      case 'add':
        const fieldset = event.target.closest('fieldset'),
              ele = await renderTemplate(`${MODULE.path}/templates/partials/filters.hbs`, {
                module: MODULE.ns,
                key: event.target.dataset.settingsKey,
                index: fieldset.querySelectorAll('.form-group').length
              });

        fieldset.insertAdjacentHTML('beforeend',ele);

        fieldset.querySelector('button[data-action="deleteRow"').addEventListener('click', async (e) => {
          e.preventDefault();
            if(!e.target.dataset.action) return ui.notifications.error("No action found for the provided key");
              this._runAction(e);
        });

        //get AIP API and reregister
        const { refreshPackageConfig } =  game.modules.get("autocomplete-inline-properties").API;
        refreshPackageConfig(this);
        break;
      case 'delete':
        const updateSetting = event.target.dataset?.updateSetting ? true : false,
              row = event.target.parentNode.parentNode,
              confirm = await Dialog.confirm({
                title: game.i18n.localize("Delete row?"),
                content: "<p>Are you sure you want to delete this row?</p>",
                defaultYes: false
              });

        if(!confirm) return;

        if(updateSetting && row.dataset.name) {
          let [module, settingsKey, ...rowKey] = row.dataset.name.split('.'),
              settingData = await game.settings.get(MODULE.ns, settingsKey);

          delete settingData[rowKey.join('.')];
          await game.settings.set(MODULE.ns, settingsKey, settingData);
        }

        row.remove();

        break;
    }
  }
}