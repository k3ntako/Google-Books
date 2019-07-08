import React, {Component} from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { IoMdBook } from "react-icons/io";

import AbortableFetchGoogle from '../../models/AbortableFetchGoogle';
import { googleBooksURL, MAX_RESULTS } from '../../utilities/GoogleBooksURL';
import { parseQuery } from '../../utilities/SearchHelper';
import Results from './Results';
import PageNavigation from './PageNavigation';
import Recommendations from './Recommendations';

const FIELDS = "fields=totalItems,items(id,volumeInfo(authors,imageLinks(thumbnail),publisher,title,subtitle))";

const options = {
  intitle: "title",
  inauthor: "author",
  inpublisher: "publisher",
  subject: "category",
  isbn: "ISBN",
}

class Search extends Component {

  constructor(props){
    super(props);

    const parsed = parseQuery(props.location.search.slice(1));

    this.state = {
      searchString: parsed.q,
      currentPage: parsed.p,
      results: {},
      totalItems : null,
      fetchingCurrentPage: true,
    };
  }

  componentDidMount(){
    if( this.state.searchString ){
      this.setUpFetch(this.state.currentPage || 0)
    }
  }

  setUpFetch( pageNum = 0 ){
    const newFetch = new AbortableFetchGoogle;
    const results = Object.assign({}, this.state.results, { [pageNum]: newFetch });
    this.setState({
      results,
      fetchingCurrentPage: pageNum === this.state.currentPage
    }, () => this.fetchSearch(pageNum));
  }

  async fetchSearch(pageNum){
    try{
      const { currentPage, results, searchString } = this.state;

      const searchQuery = searchString.replace(/\s+/g, "+"); // replaces whitespace with "+"
      const url = googleBooksURL({
        search: `startIndex=${pageNum * MAX_RESULTS}&q=${searchQuery}&${FIELDS}`
      });

      const googleFetch = results[pageNum];
      await googleFetch.aFetch( url );

      if( googleFetch.fetchSucessful ){
        this.setState({
          totalItems: googleFetch.response.totalItems,
          fetchingCurrentPage: false
        });
      }else if( !googleFetch.isFetching && !googleFetch.didAbort){
        this.setState({
          totalItems: 0,
          fetchingCurrentPage: false
        });
      }

      if( !results[currentPage + 1] && !googleFetch.didAbort ){
        this.setUpFetch( currentPage + 1 );
      }
    }catch( err ){
      console.error(err);
    }
  }

  alreadyFetched( pageNum ){
    return !!this.state.results[pageNum];
  }

  onPageChange( pageNum ){
    this.setState({
      currentPage: pageNum
    }, () => {
      if( !this.alreadyFetched(pageNum) ){
        this.setUpFetch( pageNum );
      }else if(!this.alreadyFetched(pageNum + 1)){
        this.setUpFetch( pageNum + 1 );
      }
    });
  }


  componentDidUpdate(prevProps, prevState, snapshot){
    try{
      const parsed = parseQuery(this.props.location.search.slice(1));
      const oldParsed = parseQuery(prevProps.location.search.slice(1));

      if( parsed.q && (!oldParsed.q || oldParsed.q !== parsed.q) ){
        //Search Term Changed or New Search
        this.setState({
          searchString: parsed.q,
          results: {},
          totalItems : null,
          currentPage: parsed.p || 0,
        }, () => {
          this.setUpFetch(parsed.p);
        });
      }else if( parsed && oldParsed && oldParsed.q === parsed.q && oldParsed.p !== parsed.p ){
        //Page changed on same search
        this.setState({ searchString: parsed.q, currentPage: parsed.p });
        this.onPageChange( parsed.p );
      }else if( !parsed.q && this.state.searchString ){
        // Going to homepage but old state is still around
        this.setState({
          searchString: "",
          results: {},
          totalItems: null,
          currentPage: 0,
        });
      }
    }catch( err ){
      console.error(err);
    }
  }

  componentWillUnmount(){
    for (let pageNum in this.state.results){
      this.state.results[pageNum].abort();
    }
  }

  render(){
    const { currentPage, fetchingCurrentPage, results, searchString, totalItems } = this.state;

    // Homepage (user hasn't searched yet)
    if( !searchString ){
      return <section className="page">
        <Recommendations />
      </section>
    }

    let books, title;
    if( results && results[currentPage] ){
      let query = searchString;
      for( let type in options ){
        const regex = new RegExp(`${type}:`, "g");
        query = query.replace(regex, options[type] + ": ");
      }
      title = `Search for ${query}`;

      books = results[currentPage].all;
    }

    const noResults = !fetchingCurrentPage && !books && totalItems !== null; //totalItems === null means it's searching

    return <section className="page">
      <Results books={books} title={title} noResults={noResults} />
      <PageNavigation
        totalItems={totalItems}
        currentPage={currentPage}
        currentPageBookCount={books && books.length} />
    </section>
  }
}

Search.propTypes = {
  location: PropTypes.shape({
    search: PropTypes.string,
  }),
}

export default withRouter(Search);
