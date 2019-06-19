class AbortableFetch {
  constructor(){
    this._controller = new AbortController();
    this._signal = this._controller.signal;
    this._response = null;
    this._isFetching = false;
    this._fetchSucessful = null;
  }

  get response(){
    return this._response;
  }

  get isFetching(){
    return this._isFetching;
  }

  get fetchSucessful(){
    return this._fetchSucessful;
  }

  async aFetch( url ){
    try{
      this._isFetching = true;

      const response = await fetch( url, { signal: this._signal } );

      if( response.ok ){
        const json = await response.json();
        this._response = json;
        this._fetchSucessful = true;
      }else{
        this._fetchSucessful = false;
      }

      this._isFetching = false;
    }catch( err ){
      this._isFetching = false;
      this._fetchSucessful = false;
    }
  }

  async getCacheOrFetch(url, cacheKey, expires){
    this._isFetching = true;

    const cachedContent = this.getCache(cacheKey);

    if( cachedContent && cachedContent.cached && cachedContent.cached.expires > Date.now()){
      this._response = cachedContent;
      this._fetchSucessful = true;
      this._isFetching = false;
    }else{
      await this.aFetch( url );

      const FIVE_MINS = Date.now() + 1000 * 60 * 5;
      for( let key in localStorage ){
        const content = JSON.parse(localStorage.getItem(key));
        const expires = content && content.cached && content.cached.expires;
        if( typeof expires === 'number' && expires < FIVE_MINS){
          localStorage.removeItem(key);
        }
      }

      if( this._fetchSucessful ){
        const jsonToCache = Object.assign({
          cached: {
            expires: expires || Date.now() + 1000 * 60 * 60 * 24
          }
        }, this._response);
        this.setCache(cacheKey, jsonToCache);
      }
    }
  }

  getCache(cacheKey){
    if( cacheKey ){
      const content = localStorage.getItem("aFetch" + cacheKey);
      return JSON.parse(content);
    }
    return null;
  }

  setCache(cacheKey, json){
    if( cacheKey ){
      localStorage.setItem("aFetch" + cacheKey, JSON.stringify(json));
      return true;
    }
    return false;
  }


  abort(){
    if( this._isFetching ){
      this._controller.abort();
    }
  }
}

export default AbortableFetch;
