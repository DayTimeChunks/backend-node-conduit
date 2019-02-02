
## End of Front End Tutorial

...see [here](https://thinkster.io/tutorials/build-a-real-world-react-redux-application) for the free introductory 
part of the tutorial

## Writing the Render Function

See video: Conduit/RenderFunction.mp4

Next let's write the actual render function for the editor component.

#### Write the render function for the Editor component

    class Editor extends React.Component {
    render() {
        return (
          <div className="editor-page">
            <div className="container page">
              <div className="row">
                <div className="col-md-10 offset-md-1 col-xs-12">
    
                  <ListErrors errors={this.props.errors}></ListErrors>
    
                  <form>
                    <fieldset>
    
                      <fieldset className="form-group">
                        <input
                          className="form-control form-control-lg"
                          type="text"
                          placeholder="Article Title"
                          value={this.props.title}
                          onChange={this.changeTitle} />
                      </fieldset>
    
                      <fieldset className="form-group">
                        <input
                          className="form-control"
                          type="text"
                          placeholder="What's this article about?"
                          value={this.props.description}
                          onChange={this.changeDescription} />
                      </fieldset>
    
                      <fieldset className="form-group">
                        <textarea
                          className="form-control"
                          rows="8"
                          placeholder="Write your article (in markdown)"
                          value={this.props.body}
                          onChange={this.changeBody}>
                        </textarea>
                      </fieldset>
    
                      <fieldset className="form-group">
                        <input
                          className="form-control"
                          type="text"
                          placeholder="Enter tags"
                          value={this.props.tagInput}
                          onChange={this.changeTagInput}
                          onKeyUp={this.watchForEnter} />
    
                        <div className="tag-list">
                          {
                            (this.props.tagList || []).map(tag => {
                              return (
                                <span className="tag-default tag-pill" key={tag}>
                                  <i  className="ion-close-round"
                                      onClick={this.removeTagHandler(tag)}>
                                  </i>
                                  {tag}
                                </span>
                              );
                            })
                          }
                        </div>
                      </fieldset>
    
                      <button
                        className="btn btn-lg pull-xs-right btn-primary"
                        type="button"
                        disabled={this.props.inProgress}
                        onClick={this.submitForm}>
                        Publish Article
                      </button>
    
                    </fieldset>
                  </form>
    
                </div>
              </div>
            </div>
          </div>
        );
      }
    }
    

Next up, we need to wire up react-router to use this component in `index.js`

#### Update `src/index.js`: 
    
    import { Provider } from 'react-redux';
    import ReactDOM from 'react-dom';
    import React from 'react';
    import { Router, Route, IndexRoute, hashHistory } from 'react-router';
    
    import App from './components/App';
    import Article from './components/Article';
    import Editor from './components/Editor';
    import Home from './components/Home';
    import Login from './components/Login';
    import Profile from './components/Profile';
    import ProfileFavorites from './components/ProfileFavorites';
    import Register from './components/Register';
    import Settings from './components/Settings';
    import store from './store';
    
    ReactDOM.render((
      <Provider store={store}>
        <Router history={hashHistory}>
          <Route path="/" component={App}>
            <IndexRoute component={Home} />
            <Route path="login" component={Login} />
            <Route path="register" component={Register} />
            <Route path="settings" component={Settings} />
            <Route path="article/:id" component={Article} />
            <Route path="@:username" component={Profile} />
            <Route path="@:username/favorites" component={ProfileFavorites} />
            <Route path="editor" component={Editor} />
            <Route path="editor/:slug" component={Editor} />
          </Route>
        </Router>
      </Provider>
    ), document.getElementById('main'));
    

## Wiring Up Reducers

See video: `Conduit/WritingUpReducers.mp4`

First up, we need a new editor reducer to handle updating the various editor form actions.

#### Update `src/reducers/editor.js`

    export default (state = {}, action) => {
      switch (action.type) {
        case 'EDITOR_PAGE_LOADED':
          return {
            ...state,
            articleSlug: action.payload ? action.payload.article.slug : '',
            title: action.payload ? action.payload.article.title : '',
            description: action.payload ? action.payload.article.description : '',
            body: action.payload ? action.payload.article.body : '',
            tagInput: '',
            tagList: action.payload ? action.payload.article.tagList : []
          };
        case 'EDITOR_PAGE_UNLOADED':
          return {};
        case 'ARTICLE_SUBMITTED':
          return {
            ...state,
            inProgress: null,
            errors: action.error ? action.payload.errors : null
          };
        case 'ASYNC_START':
          if (action.subtype === 'ARTICLE_SUBMITTED') {
            return { ...state, inProgress: true };
          }
          break;
        case 'ADD_TAG':
          return {
            ...state,
            tagList: state.tagList.concat([state.tagInput]),
            tagInput: ''
          };
        case 'REMOVE_TAG':
          return {
            ...state,
            tagList: state.tagList.filter(tag => tag !== action.tag)
          };
        case 'UPDATE_FIELD_EDITOR':
          return { ...state, [action.key]: action.value };
      }
    
      return state;
    };
    
Next up, we need to add this reducer to our main reducer:

#### Update `src/store.js`

    import { applyMiddleware, createStore, combineReducers } from 'redux';
    import { promiseMiddleware, localStorageMiddleware } from './middleware';
    import article from './reducers/article';
    import articleList from './reducers/articleList';
    import auth from './reducers/auth';
    import common from './reducers/common';
    import editor from './reducers/editor';
    import home from './reducers/home';
    import profile from './reducers/profile';
    import settings from './reducers/settings';
    
    const reducer = combineReducers({
      article,
      articleList,
      auth,
      common,
      editor,
      home,
      profile,
      settings
    });
    
    const middleware = applyMiddleware(promiseMiddleware, localStorageMiddleware);
    
    const store = createStore(reducer, middleware);
    
    export default store;
        
Finally, we also need to wire up the 'common' reducer to redirect the user to the article view when they successfully 
submit a new article:

#### Update `src/common.js`

    const defaultState = {
      appName: 'Conduit',
      token: null
    };
    
    export default (state = defaultState, action) => {
      switch (action.type) {
        // ...
        case 'LOGOUT':
          return { ...state, redirectTo: '/', token: null, currentUser: null };
        case 'ARTICLE_SUBMITTED':
          const redirectUrl = `article/${action.payload.article.slug}`;
          return { ...state, redirectTo: redirectUrl };
        case 'SETTINGS_SAVED':
        // ...
      }
      return state;
    };
    
Now you can submit an article and edit an existing article, and that means you have a fully functional conduit app. Congratulations!

#### Check your work

You can view the completed & working code from this tutorial [here](https://github.com/gothinkster/react-redux-realworld-example-app/tree/10)