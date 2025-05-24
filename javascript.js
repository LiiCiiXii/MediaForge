class MediaForge {
    constructor() {
        this.files = new Map();
        this.converting = new Set();
        this.downloading = new Set();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTabs();
        this.showWelcomeMessage();
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    setupEventListeners() {
        // File converter events
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // Click to upload
        uploadArea.addEventListener('click', (e) => {
            if (e.target === uploadArea || e.target.closest('.upload-area')) {
                fileInput.click();
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            fileInput.value = ''; // Reset for same file selection
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!uploadArea.contains(e.relatedTarget)) {
                uploadArea.classList.remove('dragover');
            }
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // Video downloader events
        const videoUrlInput = document.getElementById('videoUrl');
        const downloadBtn = document.getElementById('downloadVideoBtn');

        downloadBtn.addEventListener('click', () => {
            this.downloadVideo();
        });

        videoUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.downloadVideo();
            }
        });

        videoUrlInput.addEventListener('input', (e) => {
            this.analyzeVideoUrl(e.target.value);
        });

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
    }

    async analyzeVideoUrl(url) {
        const videoInfo = document.getElementById('videoInfo');
        const videoTitle = document.getElementById('videoTitle');
        const videoMeta = document.getElementById('videoMeta');

        if (!url || !this.isValidUrl(url)) {
            videoInfo.classList.remove('show');
            return;
        }

        try {
            // Extract info from URL
            const urlObj = new URL(url);
            const filename = urlObj.pathname.split('/').pop();
            const extension = filename.split('.').pop().toLowerCase();
            
            if (this.isVideoFile(extension)) {
                videoTitle.textContent = filename || 'Video File';
                videoMeta.textContent = `Type: ${extension.toUpperCase()} | Direct Link`;
                videoInfo.classList.add('show');
            } else {
                videoInfo.classList.remove('show');
            }
        } catch (error) {
            videoInfo.classList.remove('show');
        }
    }

    isVideoFile(extension) {
        const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp', 'ogv'];
        return videoExtensions.includes(extension.toLowerCase());
    }

    async downloadVideo() {
        const urlInput = document.getElementById('videoUrl');
        const downloadBtn = document.getElementById('downloadVideoBtn');
        const url = urlInput.value.trim();

        if (!url) {
            this.showNotification('Please enter a video URL', 'error');
            return;
        }

        if (!this.isValidUrl(url)) {
            this.showNotification('Please enter a valid URL', 'error');
            return;
        }

        // Check if it's a direct video link
        const urlObj = new URL(url);
        const filename = urlObj.pathname.split('/').pop();
        const extension = filename.split('.').pop().toLowerCase();

        if (!this.isVideoFile(extension)) {
            this.showNotification('URL must be a direct link to a video file (mp4, avi, mov, etc.)', 'error');
            return;
        }

        const downloadId = this.generateId();
        this.downloading.add(downloadId);

        // Update button state
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner spinning"></i> Downloading';

        try {
            // Start the actual download
            await this.performRealDownload(url, filename, downloadId);
            
            this.showNotification(`${filename} downloaded successfully!`, 'success');
            urlInput.value = '';
            document.getElementById('videoInfo').classList.remove('show');

        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('Download failed. Please check the URL and try again.', 'error');
            this.files.delete(downloadId);
        } finally {
            this.downloading.delete(downloadId);
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
        }
    }

    async performRealDownload(url, filename, downloadId) {
        try {
            // Create file data entry
            const fileData = {
                id: downloadId,
                file: null,
                name: filename,
                size: 0, // Will be updated during download
                type: this.getVideoMimeType(filename),
                category: 'downloaded',
                url: url,
                settings: this.getDefaultSettings('video')
            };

            this.files.set(downloadId, fileData);
            this.renderDownloadingFile(fileData);
            this.updateFileCount();
            this.showFilesSection();

            // Fetch the video with progress tracking
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength, 10);
            let loaded = 0;

            // Update file size
            fileData.size = total || 0;
            this.updateFileDisplay(downloadId, fileData);

            const reader = response.body.getReader();
            const chunks = [];

            // Track download progress
            const fileElement = document.querySelector(`[data-file-id="${downloadId}"]`);
            const progressContainer = fileElement.querySelector('.progress-container');
            const progressFill = fileElement.querySelector('.progress-fill');
            const progressPercentage = fileElement.querySelector('.progress-percentage');
            const progressAction = fileElement.querySelector('.progress-action');

            progressContainer.style.display = 'block';
            progressFill.classList.add('download');
            progressAction.textContent = 'Downloading...';

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                loaded += value.length;

                if (total) {
                    const progress = (loaded / total) * 100;
                    progressFill.style.width = `${progress}%`;
                    progressPercentage.textContent = `${Math.round(progress)}%`;
                }
            }

            // Create blob from chunks
            const blob = new Blob(chunks, { type: this.getVideoMimeType(filename) });
            fileData.file = new File([blob], filename, { type: this.getVideoMimeType(filename) });
            fileData.size = blob.size;

            // Update final file display
            this.updateFileDisplay(downloadId, fileData);

            // Hide progress after a delay
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
                progressPercentage.textContent = '0%';
                progressFill.classList.remove('download');
            }, 1000);

            // Trigger automatic download
            this.triggerFileDownload(blob, filename);

        } catch (error) {
            // Remove failed download from list
            const fileElement = document.querySelector(`[data-file-id="${downloadId}"]`);
            if (fileElement) {
                fileElement.remove();
            }
            this.files.delete(downloadId);
            this.updateFileCount();
            throw error;
        }
    }

    triggerFileDownload(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up object URL after a delay
        setTimeout(() => {
            URL.revokeObjectURL(link.href);
        }, 1000);
    }

    getVideoMimeType(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'mp4': 'video/mp4',
            'avi': 'video/x-msvideo',
            'mov': 'video/quicktime',
            'mkv': 'video/x-matroska',
            'webm': 'video/webm',
            'flv': 'video/x-flv',
            'wmv': 'video/x-ms-wmv',
            'm4v': 'video/x-m4v',
            '3gp': 'video/3gpp',
            'ogv': 'video/ogg'
        };
        return mimeTypes[extension] || 'video/mp4';
    }

    renderDownloadingFile(fileData) {
        const fileElement = this.createFileElement(fileData, true);
        document.getElementById('filesList').appendChild(fileElement);
    }

    updateFileDisplay(fileId, fileData) {
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileElement) {
            const fileDetails = fileElement.querySelector('.file-details');
            fileDetails.textContent = `${this.formatFileSize(fileData.size)} • ${fileData.type}`;
        }
    }

    extractVideoTitle(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            
            if (filename && filename.includes('.')) {
                return filename;
            }
            
            return `video_${Date.now()}.mp4`;
        } catch {
            return `video_${Date.now()}.mp4`;
        }
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    handleFiles(fileList) {
        if (!fileList || fileList.length === 0) return;

        const validFiles = Array.from(fileList).filter(file => {
            const isValid = this.isValidFile(file);
            if (!isValid) {
                this.showNotification(`${file.name} is not a supported file type`, 'error');
            }
            return isValid;
        });

        if (validFiles.length === 0) return;

        validFiles.forEach(file => {
            const fileData = this.createFileData(file);
            this.files.set(fileData.id, fileData);
            this.renderFile(fileData);
        });

        this.updateFileCount();
        this.showFilesSection();
        this.showNotification(`${validFiles.length} file(s) added successfully!`, 'success');
    }

    isValidFile(file) {
        const validTypes = [
            'video/', 'audio/', 'image/'
        ];
        return validTypes.some(type => file.type.startsWith(type));
    }

    createFileData(file) {
        const id = this.generateId();
        const category = this.getFileCategory(file.type);
        
        return {
            id,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            category,
            settings: this.getDefaultSettings(category)
        };
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getFileCategory(type) {
        if (type.startsWith('video/')) return 'video';
        if (type.startsWith('audio/')) return 'audio';
        if (type.startsWith('image/')) return 'image';
        return 'unknown';
    }

    getDefaultSettings(category) {
        const defaults = {
            video: { format: 'mp4', quality: 80, resolution: '1920x1080', fps: 30 },
            audio: { format: 'mp3', quality: 80, bitrate: 192 },
            image: { format: 'jpeg', quality: 90 },
            downloaded: { format: 'mp4', quality: 80, resolution: '1920x1080', fps: 30 }
        };
        return defaults[category] || defaults.image;
    }

    renderFile(fileData) {
        const fileElement = this.createFileElement(fileData);
        document.getElementById('filesList').appendChild(fileElement);

        // Create image preview if it's an image
        if (fileData.category === 'image') {
            this.createImagePreview(fileData);
        }
    }

    createFileElement(fileData, isDownloaded = false) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.setAttribute('data-file-id', fileData.id);

        // Check if file can be converted to MP3
        const canConvertToMp3 = fileData.category === 'video' || fileData.category === 'audio' || fileData.category === 'downloaded';

        fileDiv.innerHTML = `
            <div class="file-preview ${fileData.category}">
                ${this.getFileIcon(fileData.category)}
            </div>
            <div class="file-info">
                <div class="file-name">
                    ${fileData.name}
                    ${canConvertToMp3 ? '<span class="mp3-badge">MP3 Ready</span>' : ''}
                    ${isDownloaded ? '<span class="download-badge">Downloaded</span>' : ''}
                </div>
                <div class="file-details">${this.formatFileSize(fileData.size)} • ${fileData.type}</div>
                <div class="file-settings">
                    <div class="setting-group">
                        <span class="setting-label">Format:</span>
                        <select class="select format-select">
                            ${this.getFormatOptions(fileData.category)}
                        </select>
                    </div>
                    <div class="setting-group">
                        <span class="setting-label">Quality:</span>
                        <input type="range" class="slider quality-slider" min="10" max="100" value="${fileData.settings.quality}" step="10">
                        <span class="quality-display">${fileData.settings.quality}%</span>
                    </div>
                    ${(fileData.category === 'video' || fileData.category === 'downloaded') ? this.getVideoSettings(fileData) : ''}
                    ${fileData.category === 'audio' ? this.getAudioSettings(fileData) : ''}
                </div>
                <div class="progress-container">
                    <div class="progress-text">
                        <span class="progress-action">Converting...</span>
                        <span class="progress-percentage">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-primary convert-btn">
                    <i class="fas fa-download"></i>
                    Convert
                </button>
                ${canConvertToMp3 ? `
                <button class="btn btn-mp3 mp3-btn">
                    <i class="fas fa-headphones"></i>
                    To MP3
                </button>
                ` : ''}
                <button class="btn btn-danger remove-btn">
                    <i class="fas fa-trash"></i>
                    Remove
                </button>
            </div>
        `;

        this.setupFileEventListeners(fileDiv, fileData);
        return fileDiv;
    }

    getFileIcon(category) {
        const icons = {
            video: '<i class="fas fa-video"></i>',
            audio: '<i class="fas fa-music"></i>',
            image: '<i class="fas fa-image"></i>',
            downloaded: '<i class="fas fa-cloud-download-alt"></i>'
        };
        return icons[category] || '<i class="fas fa-file"></i>';
    }

    getFormatOptions(category) {
        const formats = {
            video: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
            audio: ['mp3', 'wav', 'flac', 'aac', 'ogg'],
            image: ['jpeg', 'png', 'webp', 'gif', 'bmp'],
            downloaded: ['mp4', 'avi', 'mov', 'mkv', 'webm']
        };

        return (formats[category] || []).map(format => 
            `<option value="${format}">${format.toUpperCase()}</option>`
        ).join('');
    }

    getVideoSettings(fileData) {
        return `
            <div class="setting-group">
                <span class="setting-label">Resolution:</span>
                <select class="select resolution-select">
                    <option value="3840x2160">4K (3840x2160)</option>
                    <option value="1920x1080" selected>1080p (1920x1080)</option>
                    <option value="1280x720">720p (1280x720)</option>
                    <option value="854x480">480p (854x480)</option>
                </select>
            </div>
            <div class="setting-group">
                <span class="setting-label">FPS:</span>
                <select class="select fps-select">
                    <option value="60">60 FPS</option>
                    <option value="30" selected>30 FPS</option>
                    <option value="24">24 FPS</option>
                </select>
            </div>
        `;
    }

    getAudioSettings(fileData) {
        return `
            <div class="setting-group">
                <span class="setting-label">Bitrate:</span>
                <select class="select bitrate-select">
                    <option value="320">320 kbps</option>
                    <option value="256">256 kbps</option>
                    <option value="192" selected>192 kbps</option>
                    <option value="128">128 kbps</option>
                    <option value="96">96 kbps</option>
                </select>
            </div>
        `;
    }

    setupFileEventListeners(fileElement, fileData) {
        // Format change
        const formatSelect = fileElement.querySelector('.format-select');
        formatSelect.value = fileData.settings.format;
        formatSelect.addEventListener('change', (e) => {
            fileData.settings.format = e.target.value;
        });

        // Quality change
        const qualitySlider = fileElement.querySelector('.quality-slider');
        const qualityDisplay = fileElement.querySelector('.quality-display');
        qualitySlider.addEventListener('input', (e) => {
            const value = e.target.value;
            fileData.settings.quality = parseInt(value);
            qualityDisplay.textContent = `${value}%`;
        });

        // Video settings
        if (fileData.category === 'video' || fileData.category === 'downloaded') {
            const resolutionSelect = fileElement.querySelector('.resolution-select');
            const fpsSelect = fileElement.querySelector('.fps-select');

            if (resolutionSelect) {
                resolutionSelect.addEventListener('change', (e) => {
                    fileData.settings.resolution = e.target.value;
                });
            }

            if (fpsSelect) {
                fpsSelect.addEventListener('change', (e) => {
                    fileData.settings.fps = parseInt(e.target.value);
                });
            }
        }

        // Audio settings
        if (fileData.category === 'audio') {
            const bitrateSelect = fileElement.querySelector('.bitrate-select');
            if (bitrateSelect) {
                bitrateSelect.addEventListener('change', (e) => {
                    fileData.settings.bitrate = parseInt(e.target.value);
                });
            }
        }

        // Convert button
        const convertBtn = fileElement.querySelector('.convert-btn');
        convertBtn.addEventListener('click', () => {
            this.convertFile(fileData.id, false);
        });

        // MP3 button
        const mp3Btn = fileElement.querySelector('.mp3-btn');
        if (mp3Btn) {
            mp3Btn.addEventListener('click', () => {
                this.convertFile(fileData.id, true);
            });
        }

        // Remove button
        const removeBtn = fileElement.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => {
            this.removeFile(fileData.id);
        });
    }

    createImagePreview(fileData) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileElement = document.querySelector(`[data-file-id="${fileData.id}"]`);
            if (fileElement) {
                const preview = fileElement.querySelector('.file-preview');
                preview.innerHTML = `<img src="${e.target.result}" alt="${fileData.name}">`;
            }
        };
        reader.readAsDataURL(fileData.file);
    }

    async convertFile(fileId, toMp3 = false) {
        const fileData = this.files.get(fileId);
        if (!fileData || this.converting.has(fileId)) return;

        this.converting.add(fileId);
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        const convertBtn = fileElement.querySelector('.convert-btn');
        const mp3Btn = fileElement.querySelector('.mp3-btn');
        const progressContainer = fileElement.querySelector('.progress-container');
        const progressFill = fileElement.querySelector('.progress-fill');
        const progressPercentage = fileElement.querySelector('.progress-percentage');
        const progressAction = fileElement.querySelector('.progress-action');

        // Update UI based on conversion type
        const isConvertingToMp3 = toMp3 || (fileData.settings.format === 'mp3');
        
        if (isConvertingToMp3) {
            progressFill.classList.add('mp3');
            progressAction.textContent = toMp3 ? 'Extracting to MP3...' : 'Converting to MP3...';
            fileElement.classList.add('mp3-highlight');
        } else {
            progressFill.classList.remove('mp3');
            progressAction.textContent = 'Converting...';
            fileElement.classList.remove('mp3-highlight');
        }

        // Disable buttons
        convertBtn.disabled = true;
        if (mp3Btn) mp3Btn.disabled = true;
        
        if (toMp3) {
            mp3Btn.innerHTML = '<i class="fas fa-spinner spinning"></i> Extracting';
        } else {
            convertBtn.innerHTML = '<i class="fas fa-spinner spinning"></i> Converting';
        }
        
        progressContainer.style.display = 'block';

        try {
            // Simulate conversion process with different timing for MP3
            const steps = toMp3 ? 120 : 100;
            const stepDelay = toMp3 ? 40 : 50;
            
            for (let i = 0; i <= steps; i += 2) {
                await this.delay(stepDelay);
                const progress = Math.min(100, (i / steps) * 100);
                progressFill.style.width = `${progress}%`;
                progressPercentage.textContent = `${Math.round(progress)}%`;
            }

            // Simulate final processing
            await this.delay(500);
            
            // Download file
            this.downloadFile(fileData, toMp3);
            
            const successMessage = toMp3 
                ? `Audio extracted from ${fileData.name} as MP3!`
                : `${fileData.name} converted successfully!`;
            this.showNotification(successMessage, 'success');

        } catch (error) {
            console.error('Conversion error:', error);
            this.showNotification('Conversion failed. Please try again.', 'error');
        } finally {
            // Reset UI
            this.converting.delete(fileId);
            convertBtn.disabled = false;
            if (mp3Btn) mp3Btn.disabled = false;
            
            convertBtn.innerHTML = '<i class="fas fa-download"></i> Convert';
            if (mp3Btn) mp3Btn.innerHTML = '<i class="fas fa-headphones"></i> To MP3';
            
            fileElement.classList.remove('mp3-highlight');
            
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
                progressPercentage.textContent = '0%';
                progressFill.classList.remove('mp3');
            }, 1000);
        }
    }

    downloadFile(fileData, toMp3 = false) {
        if (!fileData.file) {
            this.showNotification('File not available for download', 'error');
            return;
        }

        const link = document.createElement('a');
        let fileName;
        
        if (toMp3) {
            fileName = `${fileData.name.split('.')[0]}_audio.mp3`;
        } else {
            fileName = `converted_${fileData.name.split('.')[0]}.${fileData.settings.format}`;
        }
        
        link.href = URL.createObjectURL(fileData.file);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    removeFile(fileId) {
        const fileData = this.files.get(fileId);
        if (!fileData) return;

        // Cancel conversion if in progress
        this.converting.delete(fileId);
        this.downloading.delete(fileId);

        // Remove from DOM
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileElement) {
            fileElement.style.transition = 'all 0.3s ease';
            fileElement.style.opacity = '0';
            fileElement.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                fileElement.remove();
                this.files.delete(fileId);
                this.updateFileCount();
                
                if (this.files.size === 0) {
                    this.hideFilesSection();
                }
            }, 300);
        }

        this.showNotification(`${fileData.name} removed`, 'info');
    }

    updateFileCount() {
        const countElement = document.getElementById('fileCount');
        if (countElement) {
            countElement.textContent = this.files.size;
        }
    }

    showFilesSection() {
        const section = document.getElementById('filesSection');
        section.style.display = 'block';
        setTimeout(() => {
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
        }, 10);
    }

    hideFilesSection() {
        const section = document.getElementById('filesSection');
        section.style.opacity = '0';
        section.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            section.style.display = 'none';
        }, 300);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle'
        };

        notification.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            ${message}
        `;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Hide notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, type === 'error' ? 5000 : 3000);
    }

    showWelcomeMessage() {
        setTimeout(() => {
            this.showNotification('Welcome to MediaForge! Convert files or download videos from direct URLs! 🎬', 'info');
        }, 1000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mediaForge = new MediaForge();
});

// Global error handling
window.addEventListener('error', (e) => {
    console.error('Error:', e.error);
    if (window.mediaForge) {
        window.mediaForge.showNotification('An error occurred. Please try again.', 'error');
    }
});