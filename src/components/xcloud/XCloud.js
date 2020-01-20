import * as React from "react";
import { Link } from 'react-router-dom';
import { Alert } from 'react-bootstrap';
import $ from 'jquery';
import _ from 'lodash';
import fileDownload from 'js-file-download';
import update from 'immutability-helper';
import Popup from "reactjs-popup";
import async from 'async'

import FileCommander from './FileCommander';
import NavigationBar from "../navigationBar/NavigationBar";
import history from '../../history';
import { removeAccents } from '../../utils';
import "../../App.css";
import logo from '../../assets/logo.svg';
import closeTab from '../../assets/Dashboard-Icons/close-tab.svg';

import PopupShare from '../PopupShare'
import './XCloud.scss'

class XCloud extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      email: '',
      isAuthorized: false,
      isInitialized: false,
      isActivated: null,
      token: "",
      chooserModalOpen: false,
      rateLimitModal: false,
      currentFolderId: null,
      currentFolderBucket: null,
      currentCommanderItems: [],
      namePath: [],
      selectedItems: [],
      sortFunction: null,
      searchFunction: null,
      popupShareOpened: false,
      showDeleteItemsPopup: false,

      overwritteItemPopup: false,
      overwritteOptions: {}
    };
  }

  componentDidMount = () => {
    // When user is not signed in, redirect to login
    if (!this.props.user || !this.props.isAuthenticated) {
      history.push('/login');
    } else {
      this.isUserActivated().then(data => {
        // If user is signed in but is not activated set property isActivated to false
        const isActivated = data.activated
        if (isActivated) {
          if (!this.props.user.root_folder_id) {
            // Initialize user in case that is not done yet
            this.userInitialization().then((resultId) => {
              this.getFolderContent(resultId);
            }).catch((error) => {
              const errorMsg = error ? error : '';
              alert('User initialization error ' + errorMsg);
              history.push('/login');
            })
          } else { this.getFolderContent(this.props.user.root_folder_id); }

          this.setState({ isActivated, isInitialized: true });
        }
      }).catch(error => {
        console.log('Error getting user activation status: ' + error)
        localStorage.clear();
        history.push('/login');
      })
    }
  }

  setHeaders = () => {
    let headers = {
      Authorization: `Bearer ${localStorage.getItem("xToken")}`,
      "content-type": "application/json; charset=utf-8",
      "internxt-mnemonic": localStorage.getItem("xMnemonic")
    };
    return headers;
  }

  userInitialization = () => {
    const headers = this.setHeaders();
    return new Promise((resolve, reject) => {
      fetch('/api/initialize', {
        method: "post",
        headers,
        body: JSON.stringify({
          email: this.props.user.email,
          mnemonic: localStorage.getItem("xMnemonic")
        })
      }).then(response => {
        if (response.status === 200) {
          // Successfull intialization
          this.setState({ isInitialized: true });
          // Set user with new root folder id
          response.json().then((body) => {
            let updatedUser = this.props.user;
            updatedUser.root_folder_id = body.user.root_folder_id;
            this.props.handleKeySaved(updatedUser);
            resolve(body.user.root_folder_id);
          })
        } else { reject(null); }
      }).catch(error => { reject(error); });
    });
  }

  isUserActivated = () => {
    let headers = this.setHeaders();
    return fetch('/api/user/isactivated', {
      method: 'get',
      headers
    }).then(response => response.json())
      .catch(error => {
        console.log('Error getting user activation');
      });
  }

  setSortFunction = (newSortFunc) => {
    // Set new sort function on state and call getFolderContent for refresh files list
    this.setState({ sortFunction: newSortFunc });
    this.getFolderContent(this.state.currentFolderId);
  }

  setSearchFunction = (e) => {
    // Set search function depending on search text input and refresh items list
    const searchString = removeAccents(e.target.value.toString()).toLowerCase();
    let func = null;
    if (searchString) {
      func = function (item) { return item.name.toLowerCase().includes(searchString); }
    }
    this.setState({ searchFunction: func });
    this.getFolderContent(this.state.currentFolderId);
  }

  createFolder = () => {
    const folderName = prompt("Please enter folder name");
    const headers = this.setHeaders();
    if (folderName != null) {
      fetch(`/api/storage/folder`, {
        method: "post",
        headers,
        body: JSON.stringify({
          parentFolderId: this.state.currentFolderId,
          folderName
        })
      }).then(() => {
        this.getFolderContent(this.state.currentFolderId, false);
      });
    }
  }

  openFolder = (e) => {
    this.getFolderContent(e);
  }

  getFolderContent = (rootId, updateNamePath = true) => {
    const headers = this.setHeaders();
    fetch(`/api/storage/folder/${rootId}`, {
      method: "get",
      headers
    })
      .then(response => response.json())
      .then(data => {
        this.deselectAll();

        // Set new items list
        let newCommanderFolders = _.map(data.children, o => _.extend({ type: "Folder" }, o))
        let newCommanderFiles = data.files;

        // Apply search function if is set
        if (this.state.searchFunction) {
          newCommanderFolders = newCommanderFolders.filter(this.state.searchFunction);
          newCommanderFiles = newCommanderFiles.filter(this.state.searchFunction);
        }

        // Apply sort function if is set
        if (this.state.sortFunction) {
          newCommanderFolders.sort(this.state.sortFunction);
          newCommanderFiles.sort(this.state.sortFunction);
        }
        this.setState({
          currentCommanderItems: _.concat(newCommanderFolders, newCommanderFiles),
          currentFolderId: data.id,
          currentFolderBucket: data.bucket,
          selectedItems: []
        });
        if (updateNamePath) {
          // Only push path if it is not the same as actual path
          if (this.state.namePath.length === 0 || (this.state.namePath[this.state.namePath.length - 1].id !== data.id)) {
            const folderName = data.name.includes("root") ? "All Files" : data.name;
            this.setState({
              namePath: this.pushNamePath({
                name: folderName,
                id: data.id,
                bucket: data.bucket
              }),
              isAuthorized: true
            });
          }
        }
      });
  }

  updateMeta = (metadata, itemId, itemType) => {
    // Apply changes on metadata depending on type of item
    const headers = this.setHeaders();
    const data = JSON.stringify({ metadata });
    if (itemType === 'Folder') {
      fetch(`/api/storage/folder/${itemId}/meta`, {
        method: "post",
        headers,
        body: data
      }).then((response) => {
        this.getFolderContent(this.state.currentFolderId);
      }).catch((error) => {
        console.log(`Error during folder customization. Error: ${error} `)
      })
    } else {
      fetch(`/api/storage/file/${itemId}/meta`, {
        method: "post",
        headers,
        body: data
      }).then((response) => {
        this.getFolderContent(this.state.currentFolderId);
      }).catch((error) => {
        console.log(`Error during file customization. Error: ${error} `)
      })
    }

  }

  moveFile = (fileId, destination, overwritte = false) => {
    const headers = this.setHeaders();
    const data = { fileId, destination, overwritte };

    fetch('/api/storage/moveFile', {
      method: 'post',
      headers,
      body: JSON.stringify(data)
    }).then((response) => {
      if (response.status === 200) {
        // Successfully moved
        this.getFolderContent(this.state.currentFolderId);
      } else if (response.status === 501) {
        this.setState({ overwritteItemPopup: true, overwritteOptions: { fileId, destination } });
      } else {
        // Error moving file
        response.json().then((error) => {
          alert(`Error moving file: ${error.message}`)
        })
      }
    })
  }

  downloadFile = (id) => {
    const headers = this.setHeaders();
    fetch(`/api/storage/file/${id}`, {
      method: "get",
      headers
    }).then(async (data) => {
      if (data.status !== 200) {
        throw data;
      }

      const blob = await data.blob();

      const name = data.headers.get('x-file-name')
      fileDownload(blob, name)
    }).catch(async err => {
      const res = await err.json();

      if (err.status === 402) {
        this.setState({ rateLimitModal: true })
      } else {

        alert('Error downloading file:\n' + err.status + ' - ' + err.statusText + '\n' + res.message + '\nFile id: ' + id);
      }
    });
  }

  openUploadFile = () => {
    $("input#uploadFile").trigger("click");
  }

  handleUploadFiles = (files) => {
    var re = /(?:\.([^.]+))?$/;

    const currentCommanderItemsLength = this.state.currentCommanderItems.length;
    let currentUploadedItems = 0;

    for (var i = 0; i < files.length; i++) {
      this.state.currentCommanderItems.push({
        name: files[i].name,
        size: files[i].size,
        isLoading: true
      });
    }

    this.setState({ currentCommanderItems: this.state.currentCommanderItems });

    async.eachSeries(files, (file, next) => {
      const data = new FormData();
      let headers = this.setHeaders();
      delete headers['content-type'];
      data.append('xfile', file);
      fetch(`/api/storage/folder/${this.state.currentFolderId}/upload`, {
        method: "post",
        headers,
        body: data
      }).then(async (response) => {
        if (response.status === 402) {
          this.setState({ rateLimitModal: true })
          return next(response.status);
        }

        if (response.status === 500) {
          const body = await response.json();
          next(body.message);
        } else {
          // Upload OK: Mark object as not loading
          let index = this.state.currentCommanderItems.findIndex(obj => {
            return obj.name === file.name
          })

          this.state.currentCommanderItems[index].isLoading = false
          this.state.currentCommanderItems[index].type = re.exec(file.name)[1];

          this.setState({ currentCommanderItems: this.state.currentCommanderItems }, () => next());
        }

      }).catch(err => {
        console.error('Error uploading: ', err);
        next(err)
      })
    }, (err, results) => {
      if (err) { alert(err) }
      this.getFolderContent(this.state.currentFolderId);
    })
  }

  uploadFile = (e) => {
    this.handleUploadFiles(e.target.files)
  }

  uploadDroppedFile = (e) => {
    this.handleUploadFiles(e)
  }

  shareItem = () => {
    const selectedItems = this.state.selectedItems;
    if (selectedItems && selectedItems.length === 1 && selectedItems[0].type !== 'Folder') {
      this.setState({ popupShareOpened: true });
    } else {
      alert("Please select one file to share");
    }
  }

  deleteItems = () => {
    const selectedItems = this.state.selectedItems;
    if (selectedItems && selectedItems.length > 0) {
      this.setState({ showDeleteItemsPopup: true });
    }
  }

  confirmDeleteItems = () => {
    const selectedItems = this.state.selectedItems;
    //const bucket = _.last(this.state.namePath).bucket;
    const headers = this.setHeaders();
    const fetchOptions = {
      method: "DELETE",
      headers
    };
    if (selectedItems.length === 0) return;
    const deletionRequests = _.map(selectedItems, (v, i) => {
      const url =
        v.type === "Folder"
          ? `/api/storage/folder/${v.id}`
          : `/api/storage/bucket/${v.bucket}/file/${v.fileId}`;
      return fetch(url, fetchOptions);
    });
    Promise.all(deletionRequests)
      .then(result => {
        setTimeout(() => {
          this.getFolderContent(this.state.currentFolderId, false);
        }, 1000);
      })
      .catch(err => {
        throw new Error(err);
      });
  }

  selectCommanderItem = (i, e) => {
    const selectedItems = this.state.selectedItems;
    const id = e.target.getAttribute("data-id");
    const type = e.target.getAttribute("data-type");
    const bucket = e.target.getAttribute("data-bridge-bucket-id");
    const fileId = e.target.getAttribute("data-bridge-file-id");
    const fileName = e.target.getAttribute("data-name");
    if (_.some(selectedItems, { id })) {
      const indexOf = _.findIndex(selectedItems, o => o.id === id);
      this.setState({
        selectedItems: update(selectedItems, { $splice: [[indexOf, 1]] })
      });
    } else {
      this.setState({
        selectedItems: update(selectedItems, { $push: [{ type, id, bucket, fileId, fileName }] })
      });
    }
    e.target.classList.toggle("selected");
  }

  deselectAll() {
    const el = document.getElementsByClassName("FileCommanderItem");
    for (let e of el) {
      e.classList.remove("selected");
    }
  }

  folderTraverseUp() {
    this.setState(this.popNamePath(), () => {
      this.getFolderContent(_.last(this.state.namePath).id, false);
    });
  }

  pushNamePath(path) {
    return update(this.state.namePath, { $push: [path] });
  }

  popNamePath() {
    return (previousState, currentProps) => {
      return {
        ...previousState,
        namePath: _.dropRight(previousState.namePath)
      };
    };
  }

  openChooserModal() {
    this.setState({ chooserModalOpen: true })
  }

  closeModal = () => {
    this.setState({ chooserModalOpen: false })
  }

  closeRateLimitModal = () => {
    this.setState({ rateLimitModal: false })
  }

  goToStorage = () => {
    history.push('/storage');
  }

  render() {
    // Check authentication
    if (this.props.isAuthenticated && this.state.isActivated && this.state.isInitialized) {
      return (
        <div className="App">
          <NavigationBar
            showFileButtons={true}
            showSettingsButton={true}
            createFolder={this.createFolder}
            uploadFile={this.openUploadFile}
            uploadHandler={this.uploadFile}
            deleteItems={this.deleteItems}
            setSearchFunction={this.setSearchFunction}
            shareItem={this.shareItem}
            style
          />
          <FileCommander
            //   folderTree={this.state.folderTree}
            currentCommanderItems={this.state.currentCommanderItems}
            openFolder={this.openFolder}
            downloadFile={this.downloadFile}
            selectCommanderItem={this.selectCommanderItem}
            namePath={this.state.namePath}
            handleFolderTraverseUp={this.folderTraverseUp.bind(this)}
            uploadDroppedFile={this.uploadDroppedFile}
            setSortFunction={this.setSortFunction}
            moveFile={this.moveFile}
            updateMeta={this.updateMeta}
            currentFolderId={this.state.currentFolderId}
            parentFolderId={null}
          />

          {this.state.selectedItems && this.state.selectedItems.length === 1 && this.state.popupShareOpened ? <PopupShare open={this.state.popupShareOpened} item={this.state.selectedItems[0]} onClose={() => {
            this.setState({ popupShareOpened: false });
          }} /> : ''}

          <Popup
            open={this.state.showDeleteItemsPopup}
            closeOnDocumentClick
            onClose={() => this.setState({ showDeleteItemsPopup: false })}
            className="popup--full-screen">
            <div className="popup--full-screen__content">
              <div className="popup--full-screen__close-button-wrapper">
                <img src={closeTab} onClick={() => this.setState({ showDeleteItemsPopup: false })} alt="Close tab" />
              </div>
              <span className="logo logo-runoutstorage"><img src={logo} alt="Logo" /></span>
              <div className="message-wrapper">
                <h1> Delete item{this.state.selectedItems.length > 1 ? 's' : ''} </h1>
                <h2>Please confirm you want to delete this item{this.state.selectedItems.length > 1 ? 's' : ''}. This action can’t be undone.</h2>
                <div className="buttons-wrapper">
                  <div className="default-button button-primary" onClick={() => { this.confirmDeleteItems(); this.setState({ showDeleteItemsPopup: false }); }}>
                    Confirm
                </div>
                </div>
              </div>
            </div>
          </Popup>

          <Popup
            open={this.state.overwritteItemPopup}
            closeOnDocumentClick
            onClose={() => this.setState({ overwritteItemPopup: false })}
            className="popup--full-screen">
            <div className="popup--full-screen__content">
              <div className="popup--full-screen__close-button-wrapper">
                <img src={closeTab} onClick={() => this.setState({ overwritteItemPopup: false })} alt="Close tab" />
              </div>
              <span className="logo logo-runoutstorage"><img src={logo} alt="Logo" /></span>
              <div className="message-wrapper">
                <h1>Replace item{this.state.selectedItems.length > 1 ? 's' : ''} </h1>
                <h2>There is already a file with the same name in that destination. Would you like to overwrite the file?</h2>
                <div className="buttons-wrapper">
                  <div className="default-button button-primary" onClick={() => {
                    this.moveFile(this.state.overwritteOptions.fileId, this.state.overwritteOptions.destination, true);
                    this.setState({ overwritteItemPopup: false });
                  }}>
                    Confirm
                </div>
                </div>
              </div>
            </div>
          </Popup>

          <Popup open={this.state.chooserModalOpen} closeOnDocumentClick onClose={this.closeModal} >
            <div>
              <a href={'xcloud://' + this.state.token + '://' + JSON.stringify(this.props.user)}>Open mobile app</a>
              <a href="/" onClick={this.closeModal}>Use web app</a>
            </div>
          </Popup>

          <Popup open={this.state.rateLimitModal} closeOnDocumentClick onClose={this.closeRateLimitModal} className="popup--full-screen">
            <div className="popup--full-screen__content">
              <div className="popup--full-screen__close-button-wrapper">
                <img src={closeTab} onClick={this.closeRateLimitModal} alt="Close tab" />
              </div>
              <span className="logo logo-runoutstorage"><img src={logo} alt="Logo" /></span>
              <div className="message-wrapper">
                <h1> You have run out of storage. </h1>
                <h2>In order to start uploading more files please click the button below to upgrade your storage plan.</h2>
                <div className="buttons-wrapper">
                  <div className="default-button button-primary" onClick={this.goToStorage}>
                    Upgrade my storage plan
                </div>
                </div>
              </div>
            </div>
          </Popup>
        </div>
      );
    } else {
      // Cases of access error
      // Not authenticated
      if (!this.props.isAuthenticated) {
        return (
          <div className="App">
            <h2>Please <Link to='/login'>login</Link> into your X Cloud account</h2>
          </div>
        )
      }
      // User not activated
      if (this.state.isActivated === false) {
        return (
          <div className="App">
            <Alert variant="danger">
              <h3>Your account needs to be activated!</h3>
              <p> Search your mail inbox for activation mail and follow its instructions </p>
            </Alert>
          </div>
        )
      }
      // If is waiting for async method return blank page
      return (<div></div>)
    }
  }
}

export default XCloud;
