(function(){
   const app = {
		container: document.querySelector('.main'),
		cardTemplate: document.querySelector('.cardTemplate'),
		converterCard: document.querySelector('.converter.card'),
		selectFromElem: document.querySelector('.fromCurrency select'),
		selectToElem: document.querySelector('.toCurrency select'),
		visibleCards: {},
		addedConversions: []
  }



   /*******************
         Utilities
   ********************/
	function* iterObj(obj = {}) {
		for (let prop of Object.keys(obj)){
			if(obj.hasOwnProperty(prop)){
				yield obj[prop];
			}
		}
	}

	app.isEqual = (id1, id2) => {
		const [fr, to] = id2;
		return id1.includes(fr) && id1.includes(to);
	}

	app.addCloseEvent = (card, id) => {
		if(!card){
			card = document;
		}
		card.querySelector('.close').addEventListener('click', function(){
			this.parentNode.parentNode.remove();
			app.idbPromise.then((db) => {
				const tx = db.transaction('conversions', 'readwrite');
				tx.objectStore('conversions').delete(id);
				return tx.complete;
			});
		});
	}

	app.structureData = (data, fr, to) => ({
		id: `${fr}_${to}`,
		date: new Date(),
		fr: fr,
		to: to,
		dc: data[`${fr}_${to}`]['val'],
		rc: data[`${to}_${fr}`]['val']
  });

	app.setCardElems = (card, data, amount) => {
		card.querySelector('.fromResultAmount').value = amount.toFixed(3);
		card.querySelector('.fromResultName').textContent = data.fr;
		const val = Number(data.dc)*amount;
		card.querySelector('.toResultAmount').textContent = val.toFixed(3);
		card.querySelector('.toResultName').textContent = data.to;
		card.querySelector('.fromRate').textContent = `1 ${data.fr} =  ${data.dc} ${data.to}`;
		card.querySelector('.toRate').textContent = `1 ${data.to} =  ${data.rc} ${data.fr}`;
		card.querySelector('.date').textContent = data.date.toUTCString();
	}	

	/* Clones the conversion card 
		template and sets data into it. */
	app.updateCoversionCard = (data, amount) => {

		let card = app.visibleCards[data.id];
		if(!card){
			card = app.cardTemplate.cloneNode(true);
			card.classList.remove('cardTemplate');
			app.visibleCards[data.id] = card;
		}

		card.setAttribute('id', data.id);
		app.setCardElems(card, data, amount);
		// add close event listener to close/delete
		app.addCloseEvent(card, data.id);
		app.addConverionEvent(card);
		insertAfter(card, app.converterCard);
		
		function insertAfter(newNode, referenceNode){
			referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
		}
	}

	/* get conversion data and updates card conversion  */
  app.getConversionData = (fr, to, amount) => {
    const query = `${fr}_${to},${to}_${fr}`;
		const url   = `http://free.currencyconverterapi.com/api/v5/convert?q=${query}`;
		const path = '/assets/scripts/countries.json';
    return fetch(url).then(res => {
			if(!res || res.status !== 200) throw new Error('No network response');
			return res.json();
		})
	}

	app.getConversion  = (fr, to, amount) => {
		app.getConversionData(fr, to, amount).then( data => {
			const structuredData = app.structureData(data.results, fr, to);
			app.updateCoversionCard(structuredData, amount);
			// adding and saving new conversion
			app.addedConversions.push({id: `${fr}_${to}`, fr, to, amount});
			app.saveAddedConversions();
		});
	}

	/********************************
	 *				WORKING!!!!!!!!!!!! 
	 *********************************/
	
	/* fetchs currencies from API and sets it to the DB */
	app.fetchCurrencyData = (db) => {
		const url = 'http://free.currencyconverterapi.com/api/v5/currencies?';
		const path = '/assets/scripts/currencies.json';
		fetch(path).then(res => {
			if(!res || res.status !== 200){
				return Promise.resolve();
			}
			return res.json();
		})
		.then(data => {
			const tx = db.transaction('currencies', 'readwrite');
			const store = tx.objectStore('currencies');
			// Turning the currencies data obj into an iterable
			const currencies = iterObj(data.results);
			console.log('saving currencies');
			for(currency of currencies){
				store.put({
					id: currency.id,
					name: currency.currencyName
				});
				app.addCurrencyOption(currency);
			}
		});
	}

	/* add one currency to the select tags */
	app.addCurrencyOption = ({id}) => {
		const slctd1 = id === 'USD' ? 'selected' : '';
		const slctd2 = id === 'EUR' ? 'selected' : '';
		app.selectFromElem
		.innerHTML +=  `<option value="${id}" ${slctd1}>${id}</option>`;
		app.selectToElem.
		innerHTML += `<option value="${id}" ${slctd2}>${id}</option>`;
	}


  app.saveAddedConversions = () => {
    app.idbPromise.then((db) => {
      if(!db) return;
      const tx = db.transaction('conversions', 'readwrite');
      const conversionsStore = tx.objectStore('conversions');
      for(let conversion of app.addedConversions){
        conversionsStore.put(conversion);
      }
      return tx.complete;
    }).then(() => {
      console.log('Conversions added');
    });
  }

	

	/***********************************************
	 					 Main Code Flow
	***********************************************/

	/* opening DB */
	app.idbPromise =  idb.open('converter-pwa', 1, (upgradeDb) => {
		console.log('opening DB')
		const currenciesStore = upgradeDb.createObjectStore(
			'currencies', 
			{ keyPath: 'id' }
		);
		const conversionStore = upgradeDb.createObjectStore(
			'conversions',
			{ keyPath: 'id' }
		);
	});

	/*  getting the currencies for the select options*/
	app.idbPromise.then( db => {
		if(!db) return;
		const tx = db.transaction('currencies');
		let store = tx.objectStore('currencies');
		return store.getAll().then(currencies => {
			if(!currencies.length){
				app.fetchCurrencyData(db);
				return;
			}
			return db.transaction('currencies')
			.objectStore('currencies')
			.getAll();
		});
	}).then(currencies => {
		if(!currencies) return;
		currencies.forEach(c => {
			app.addCurrencyOption(c);
		})
	})

	/* getting all added conversions */
  app.idbPromise.then((db) => {
    if(!db) return;
    const tx = db.transaction('conversions');
    const conversionsStore = tx.objectStore('conversions');
    return conversionsStore.getAll();
  }).then((conversions) => {
    if(!conversions.length) return;
    app.addedConversions = conversions;
    for(let conversion of app.addedConversions){
      app.getConversion(
				conversion.fr, 
				conversion.to, 
				conversion.amount
			);
    }
    
  });

	/************************************/
	/* EVENT LISTENERS ON CONVERT CARD */
	/***********************************/

	/* add new conversion */
	document.querySelector('.button.convert').addEventListener('click', function(){
		const amountElem = document.querySelector('input.amount');
		// turning amount into positive number
		let amount = amountElem.value;
		amount = Math.abs(Number(amount));
		// getting from and to currencies
		const fr = app.selectFromElem.value;
		const to   = app.selectToElem.value;
		// geting and setting conversion data
		app.getConversion(fr, to, amount);
	});

	app.addConverionEvent = (card) => {
		card.querySelector('.fromResultName.button').addEventListener('click', function(){
			const card = this.parentNode.parentNode;
			const frAmountElem 	= card.querySelector('.fromResultAmount');
			const frNameElem 	 	= card.querySelector('.fromResultName');
			const toNameElem 		= card.querySelector('.toResultName');
			// turning amount into positive number
			let amount = frAmountElem.value;
			amount = Math.abs(Number(amount));
			const fr = frNameElem.textContent;
			const to = toNameElem.textContent;
			app.getConversionData(fr, to, amount).then(data => {
				const structuredData = app.structureData(data.results, fr, to);
				app.setCardElems(card, structuredData, amount);
				app.addedConversions.push({id: `${fr}_${to}`, fr, to, amount});
				app.saveAddedConversions();
			});
		});
	}

	/* SWAP from and to currencies */
	document.querySelector('.button.exchange').addEventListener('click', function(){
		/* select containers */
		const frContainer = document.querySelector('.fromCurrency');
		const toContainer = document.querySelector('.toCurrency');
		/* getting select values */
		const fr	 = app.selectFromElem.value;
		const to  = app.selectToElem.value;
		/* cloning select elements */
		const frElem = app.selectFromElem.cloneNode(true);
		const toElem  = app.selectToElem.cloneNode(true);
		/* unselecting old options */
		frElem.querySelector(`option[value=${fr}]`)
		.removeAttribute('selected');
		toElem.querySelector(`option[value=${to}]`)
		.removeAttribute('selected');
		/* Selecting new options */
		frElem.querySelector(`option[value=${fr}]`)
		.setAttribute('selected', 'selected');
		toElem.querySelector(`option[value=${to}]`)
		.setAttribute('selected', 'selected');
		/* swaping name attributes */
		frElem.setAttribute('name', 'toCurrency');
		toElem.setAttribute('name', 'fromCurrency');
		/* removing old elements */
		app.selectFromElem.remove();
		app.selectToElem.remove();
		/* appending new select elements */
		frContainer.appendChild(toElem);
		toContainer.appendChild(frElem);
		/* setting new selectElem props */
		app.selectFromElem = toElem;
		app.selectToElem = frElem;
	});

	
   app.seedData = {
      USD_EUR: {
         id: "USD_EUR",
         val: 53.360001,
         to: "EUR",
         fr: "USD"
      },
      EUR_USD: {
         id: "EUR_USD",
         val: 0.018741,
         to: "USD",
         fr: "EUR"
      }
	}

	/* Registers service workers */
	app._registerServiceWorker = () => {
		if(!navigator.serviceWorker) return;
		navigator.serviceWorker.register('./sw.js')
		.then(() => {
			 console.log('Sw registered');
		})
		.catch(() => {
			 console.log('Sw registeration failed');
		});
 }

   window.onload = (function(){
		app._registerServiceWorker();
		// const data = app.structureData(app.seedData, 'USD', 'EUR');
		// app.updateCoversionCard(data, 300.65);


	})();
	




})();

