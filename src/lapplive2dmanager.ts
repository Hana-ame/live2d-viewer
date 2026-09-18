/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { ACubismMotion } from '@framework/motion/acubismmotion';
import { CubismWebGLOffscreenManager } from '@framework/rendering/cubismoffscreenmanager';

import * as LAppDefine from './lappdefine';
import { LAppModel } from './lappmodel';
import { LAppPal } from './lapppal';
import { LAppSubdelegate } from './lappsubdelegate';

/**
 * サンプルアプリケーションにおいてCubismModelを管理するクラス
 * モデル生成と破棄、タップイベントの処理、モデル切り替えを行う。
 */
export class LAppLive2DManager {
  /**
   * 現在のシーンで保持しているすべてのモデルを解放する
   */
  private releaseAllModel(): void {
    this._models.length = 0;
  }

  public setOffscreenSize(width: number, height: number): void {
    for (let i = 0; i < this._models.length; i++) {
      const model: LAppModel = this._models[i];
      model?.setRenderTargetSize(width, height);
    }
  }

  /**
   * 画面をドラッグした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onDrag(x: number, y: number): void {
    const model: LAppModel = this._models[0];
    if (model) {
      model.setDragging(x, y);
    }
  }

  /**
   * 画面をタップした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onTap(x: number, y: number): void {
    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(
        `[APP]tap point: {x: ${x.toFixed(2)} y: ${y.toFixed(2)}}`
      );
    }

    const model: LAppModel = this._models[0];

    if (model.hitTest(LAppDefine.HitAreaNameHead, x, y)) {
      if (LAppDefine.DebugLogEnable) {
        LAppPal.printMessage(`[APP]hit area: [${LAppDefine.HitAreaNameHead}]`);
      }
      model.setRandomExpression();
    } else if (model.hitTest(LAppDefine.HitAreaNameBody, x, y)) {
      if (LAppDefine.DebugLogEnable) {
        LAppPal.printMessage(`[APP]hit area: [${LAppDefine.HitAreaNameBody}]`);
      }
      model.startRandomMotion(
        LAppDefine.MotionGroupTapBody,
        LAppDefine.PriorityNormal,
        this.finishedMotion,
        this.beganMotion
      );
    }
  }

  /**
   * 画面を更新するときの処理
   * モデルの更新処理及び描画処理を行う
   */
  public onUpdate(): void {
    // 全てのモデルの描画処理開始前に、フレームごとのリセットフラグをクリアする
    const gl = this._subdelegate.getGl();
    CubismWebGLOffscreenManager.getInstance().beginFrameProcess(gl);

    const { width, height } = this._subdelegate.getCanvas();

    const projection: CubismMatrix44 = new CubismMatrix44();
    const model: LAppModel = this._models[0];

    // モデル未選択の間は _models が空になる。
    // その状態でもフレーム処理を止めないよう、ここで早期リターンする。
    if (model == null || model.getModel() == null) {
      CubismWebGLOffscreenManager.getInstance().endFrameProcess(gl);
      CubismWebGLOffscreenManager.getInstance().releaseStaleRenderTextures(gl);
      return;
    }

    if (model.getModel()) {
      if (model.getModel().getCanvasWidth() > 1.0 && width < height) {
        // 横に長いモデルを縦長ウィンドウに表示する際モデルの横サイズでscaleを算出する
        model.getModelMatrix().setWidth(2.0);
        projection.scale(1.0, width / height);
      } else {
        projection.scale(height / width, 1.0);
      }

      // 必要があればここで乗算
      if (this._viewMatrix != null) {
        projection.multiplyByMatrix(this._viewMatrix);
      }
    }

    model.update();
    model.draw(projection); // 参照渡しなのでprojectionは変質する。

    // モデルで使用するオフスクリーン管理の終了処理
    CubismWebGLOffscreenManager.getInstance().endFrameProcess(gl);
    // もし余っているオフスクリーンのリソースを解放したい場合行う処理
    CubismWebGLOffscreenManager.getInstance().releaseStaleRenderTextures(gl);
  }

  /**
   * 次のシーンに切りかえる
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   */
  public nextScene(): void {
    const no: number = (this._sceneIndex + 1) % LAppDefine.ModelDirSize;
    this.changeScene(no);
  }

  /**
   * シーンを切り替える
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   * @param index
   */
  private changeScene(index: number): void {
    this._sceneIndex = index;

    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(`[APP]model index: ${this._sceneIndex}`);
    }

    // ModelDir[]に保持したディレクトリ名から
    // model3.jsonのパスを決定する。
    // ディレクトリ名とmodel3.jsonの名前を一致させておくこと。
    // ビルトインモデルは Live2D 社の公式リポジトリ（CDN）から読む。
    const model: string = LAppDefine.ModelDir[index];
    const modelPath: string = LAppDefine.BUILTIN_BASE + model + '/';
    let modelJsonName: string = LAppDefine.ModelDir[index];
    modelJsonName += '.model3.json';

    this.releaseAllModel();
    const instance = new LAppModel();
    instance.setSubdelegate(this._subdelegate);
    instance.loadAssets(modelPath, modelJsonName);
    this._models.push(instance);
  }

  public setViewMatrix(m: CubismMatrix44) {
    for (let i = 0; i < 16; i++) {
      this._viewMatrix.getArray()[i] = m.getArray()[i];
    }
  }

  /**
   * モデルの追加
   */
  public addModel(sceneIndex: number = 0): void {
    this._sceneIndex = sceneIndex;
    this.changeScene(this._sceneIndex);
  }

  /**
   * 仮想ファイルシステム（アップロードされたモデル）を読み込む。
   * @param modelJsonPath model3.json の相対パス（例: "Akuru/Akuru.model3.json"）
   * @param extraExpressionFiles model3.json に書かれていない表情ファイル。
   *   皮套によっては Expressions を書かず *.exp3.json を置くだけなので、
   *   呼ぶ側が仮想 FS を走査して渡す（VTube Studio と同じ拾い方）。
   */
  public loadUploadedModel(
    modelJsonPath: string,
    extraExpressionFiles: string[] = []
  ): void {
    const dir = modelJsonPath.includes('/')
      ? modelJsonPath.slice(0, modelJsonPath.lastIndexOf('/') + 1)
      : '';
    const fileName = modelJsonPath.slice(dir.length);

    this.releaseAllModel();
    const instance = new LAppModel();
    instance.setSubdelegate(this._subdelegate);
    instance.loadAssets(dir, fileName, extraExpressionFiles);
    this._models.push(instance);
  }

  /**
   * 現在のモデルが持つ表情名の一覧を返す。
   *
   * モデルの読み込みは非同期なので、呼ぶ側は空配列を
   * 「まだ読み込み中 or 表情なし」として扱うこと。
   */
  public getExpressionNames(): string[] {
    for (const model of this._models) {
      const names = model?.getExpressionNames?.();
      if (names && names.length > 0) return names;
    }
    return [];
  }

  /**
   * 現在のモデルに表情を適用する。
   * @param name 表情名（getExpressionNames() が返した値）
   */
  public setExpression(name: string): void {
    for (const model of this._models) {
      if (model != null) {
        model.setExpression(name);
        return;
      }
    }
  }

  /**
   * 現在のモデルの表情をトグルする（同じ表情を再度押すと解除）。
   * @param name 表情名
   * @return 押下後にその表情が有効なら true
   */
  public toggleExpression(name: string): boolean {
    for (const model of this._models) {
      if (model != null) return model.toggleExpression(name);
    }
    return false;
  }

  /** 現在有効な表情名（無ければ null）。ボタンの押下状態表示に使う。 */
  public getActiveExpressionName(): string | null {
    for (const model of this._models) {
      if (model != null) return model.getActiveExpressionName();
    }
    return null;
  }

  /** すべての表情を解除する（set モードの「解除」ボタン用）。 */
  public removeAllExpressions(): void {
    for (const model of this._models) {
      if (model != null) {
        model.removeAllExpressions();
        return;
      }
    }
  }

  /** 表情を重ねて適用する（重ね掛けモード用）。 */
  public addOverlayExpression(name: string): boolean {
    for (const model of this._models) {
      if (model != null) return model.addOverlayExpression(name);
    }
    return false;
  }

  /** 重ねた表情を 1 つ外す。 */
  public removeOverlayExpression(name: string): void {
    for (const model of this._models) {
      if (model != null) {
        model.removeOverlayExpression(name);
        return;
      }
    }
  }

  /** 現在重ねられている表情名の一覧。 */
  public getOverlayExpressionNames(): string[] {
    for (const model of this._models) {
      if (model != null) return model.getOverlayExpressionNames();
    }
    return [];
  }

  /**
   * コンストラクタ
   */
  public constructor() {
    this._subdelegate = null;
    this._viewMatrix = new CubismMatrix44();
    this._models = new Array<LAppModel>();
    this._sceneIndex = 0;
  }

  /**
   * 解放する。
   */
  public release(): void {}

  /**
   * 初期化する。
   * @param subdelegate
   */
  public initialize(subdelegate: LAppSubdelegate): void {
    this._subdelegate = subdelegate;
    // 起動時はビルトインモデルの先頭を読み込む。
    // ユーザーがモデルをアップロードした場合は loadUploadedModel() が
    // これを置き換える。
    if (LAppDefine.ModelDirSize > 0) {
      this.changeScene(this._sceneIndex);
    }
  }

  /**
   * 自身が所属するSubdelegate
   */
  private _subdelegate: LAppSubdelegate;

  _viewMatrix: CubismMatrix44; // モデル描画に用いるview行列
  _models: Array<LAppModel>; // モデルインスタンスのコンテナ
  private _sceneIndex: number; // 表示するシーンのインデックス値

  // モーション再生開始のコールバック関数
  beganMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Began:');
    console.log(self);
  };
  // モーション再生終了のコールバック関数
  finishedMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Finished:');
    console.log(self);
  };
}
