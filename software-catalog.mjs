const catalog=[
 {id:'anaconda',name:'Anaconda',target:'学员电脑 D:\\Anaconda3',requirements:'已准备 2025.12-2 官方安装包作为 Windows 10 试点候选；需实机验证并确认许可',steps:['检查现有版本与 D 盘空间','校验并传输官方安装包','安装至约定目录','检查 Python、Jupyter 和 Spyder'],status:'testing'},
 {id:'jupyter',name:'Jupyter Notebook',target:'学员电脑本机 Anaconda 环境',requirements:'Anaconda 候选安装流程检查程序文件及 notebook 模块；版本、实际启动和 Windows 实机待验证',steps:['检查 conda 环境','安装或确认 Notebook','检查启动与工作目录'],status:'testing'},
 {id:'spyder',name:'Spyder',target:'学员电脑本机 Anaconda 环境',requirements:'预检可识别常见安装位置；Anaconda 候选安装流程检查程序文件及 spyder 模块，实际启动和 Windows 实机待验证',steps:['检查现有版本','安装或确认 Spyder','检查启动'],status:'testing'},
 {id:'labeling',name:'标注软件（名称待确认）',target:'学员电脑 D 盘',requirements:'需明确软件名称、版本和安装包',steps:['确认具体产品','检查现有版本','安装并验证启动'],status:'design'},
 {id:'labelme',name:'LabelMe 图像标注',target:'学员电脑 D 盘独立 Python 环境',requirements:'开源候选包 7.9.1 / Python 3.12、3.13；Windows 依赖包已核对，候选安装流程已接入但入口关闭，实机与图形启动待验证。官方独立安装包说明试用 3 天后需许可证，开源项目采用 GPL-3.0',steps:['确认开源版本及许可','准备独立环境和依赖','安装并检查本地启动','验证标注文件'],status:'testing',source:'https://github.com/wkentaro/labelme'},
 {id:'labelimg',name:'LabelImg 图像标注',target:'学员电脑 D 盘或独立 Python 环境',requirements:'官方 GitHub 项目已归档；需确认是否使用历史版本、Windows 10 兼容性及依赖',steps:['确认实际考试软件','核验历史版本与依赖','安装并验证启动','检查导出格式'],status:'design',source:'https://github.com/HumanSignal/labelImg'},
 {id:'doccano',name:'doccano',target:'学员电脑本机',requirements:'候选 doccano 1.8.4 使用独立 Python 3.11；依赖存在已知漏洞，Windows 实机兼容性未验证，安装入口关闭',steps:['检查独立环境','核验依赖与安全问题','安装或确认 doccano','验证本地访问与项目目录'],status:'testing'},
 {id:'label-studio',name:'Label Studio',target:'学员电脑本机',requirements:'候选 Label Studio 1.23.2 使用独立 Python 3.13；部分依赖有已知漏洞且上游固定版本限制升级，Windows 实机未验证，安装入口关闭',steps:['检查独立环境','核验依赖与安全问题','安装或确认 Label Studio','验证本地访问与项目目录'],status:'testing'},
 {id:'spss',name:'SPSS',target:'学员电脑 D 盘',requirements:'需提供合法安装包、版本和许可',steps:['检查现有版本与许可','校验安装包','按授权安装','验证启动'],status:'design'},
 {id:'sqlite',name:'SQLite',target:'学员电脑 D 盘',requirements:'已准备官方 3.54.1 命令行工具；图形工具需求待确认',steps:['确认交付形式','检查目标目录','部署并校验文件','验证运行'],status:'testing'},
 {id:'praat',name:'Praat',target:'学员电脑 D 盘',requirements:'已准备官方 7.0.02 Windows x64 包；需完成实机验证',steps:['检查目标目录','校验并部署软件','验证启动'],status:'testing'},
 {id:'wps',name:'WPS',target:'学员电脑本机',requirements:'确认现有版本及文件位置',steps:['检查现有版本','按需安装或配置','验证启动'],status:'design'},
 {id:'onnx',name:'ONNX Python 包',target:'学员电脑本机指定 Python 环境',requirements:'试点候选 ONNX 1.22.0；缺少 ml_dtypes 时可使用校验过的离线包补装，其他依赖需满足；考试版本及实机验证待确认',steps:['识别目标 Python 环境','检查已安装版本','按需安装固定版本','验证导入'],status:'testing'},
 {id:'opencv',name:'OpenCV Python 包（cv2）',target:'学员电脑本机 Anaconda 环境',requirements:'服务器已准备哈希校验的 Windows 安装包；依赖需已满足，Windows 实机与目标环境待确认',steps:['检查目标 Python 和现有版本','仅在缺失时执行安装','验证 cv2 导入及版本'],status:'testing'}
];
export function softwareCatalog(){return structuredClone(catalog)}
