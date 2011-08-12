<?php
if (!defined('_CAN_LOAD_FILES_'))
	exit;

class SolrBridge extends Module
{
	public function __construct()
	{
		$this->name = 'solrbridge';
		$this->tab = 'search_filter';
		$this->version = '1.0';
		$this->author = 'SolrBridge';
		$this->need_instance = 0;

		parent::__construct();

		$this->displayName = $this->l('Solr Bridge');
		$this->description = $this->l('Add advanced search feature into Pretashop.');
	}
	
	public function install()
	{
		if (!parent::install() OR !$this->registerHook('top')
			)
			return false;
		return true;
	}
	
	public function hookTop($params)
	{
		$this->_hookCommon($params);
		return $this->display(__FILE__, 'blocksearch-top.tpl');
	}

	/**
	 * _hookAll has to be called in each hookXXX methods. This is made to avoid code duplication.
	 * 
	 * @param mixed $params 
	 * @return void
	 */
	private function _hookCommon($params)
	{
		global $smarty;
		
		Tools::addJS(($this->_path).'ajax-solr/core/Core.js');
		Tools::addJS(($this->_path).'ajax-solr/core/AbstractManager.js');
		Tools::addJS(($this->_path).'ajax-solr/core/AbstractWidget.js');
		Tools::addJS(($this->_path).'ajax-solr/core/Parameter.js');
		Tools::addJS(($this->_path).'ajax-solr/core/ParameterStore.js');
		Tools::addJS(($this->_path).'ajax-solr/managers/Manager.jquery.js');
		Tools::addJS(($this->_path).'ajax-solr/autocompleteWidget.js');
		
		Tools::addCSS(_PS_CSS_DIR_.'jquery.autocomplete.css');
		Tools::addCSS(_THEME_CSS_DIR_.'product_list.css');
		Tools::addCSS(($this->_path).'solrbridge.css', 'all');
		
		return true;
	}
}