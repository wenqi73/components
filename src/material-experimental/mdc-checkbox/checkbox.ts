/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {coerceBooleanProperty} from '@angular/cdk/coercion';
import {Platform} from '@angular/cdk/platform';
import {
  AfterViewInit,
  Attribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Inject,
  Input,
  OnDestroy,
  Optional,
  Output,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {MAT_CHECKBOX_CLICK_ACTION, MatCheckboxClickAction} from '@angular/material/checkbox';
import {ThemePalette} from '@angular/material/core';
import {ANIMATION_MODULE_TYPE} from '@angular/platform-browser/animations';
import {MDCCheckboxAdapter, MDCCheckboxFoundation} from '@material/checkbox';
import {numbers} from '@material/ripple';

let nextUniqueId = 0;

export const MAT_CHECKBOX_CONTROL_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MatCheckbox),
  multi: true
};

/** Change event object emitted by MatCheckbox. */
export class MatCheckboxChange {
  /** The source MatCheckbox of the event. */
  source: MatCheckbox;
  /** The new `checked` value of the checkbox. */
  checked: boolean;
}

@Component({
  moduleId: module.id,
  selector: 'mat-checkbox',
  templateUrl: 'checkbox.html',
  styleUrls: ['checkbox.css'],
  host: {
    'class': 'mat-mdc-checkbox',
    '[attr.tabindex]': 'null',
    '[class.mat-primary]': 'color == "primary"',
    '[class.mat-accent]': 'color == "accent"',
    '[class.mat-warn]': 'color == "warn"',
    '[class._mat-animation-noopable]': `_animationMode === 'NoopAnimations'`,
    '[class.mdc-checkbox--disabled]': 'disabled',
    '[id]': 'id',
  },
  providers: [MAT_CHECKBOX_CONTROL_VALUE_ACCESSOR],
  exportAs: 'matCheckbox',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatCheckbox implements AfterViewInit, OnDestroy, ControlValueAccessor {
  /**
   * The `aria-label` attribute to use for the input element. In most cases, `aria-labelledby` will
   * take precedence so this may be omitted.
   */
  @Input('aria-label') ariaLabel: string = '';

  /** The `aria-labelledby` attribute to use for the input element. */
  @Input('aria-labelledby') ariaLabelledby: string|null = null;

  /** The color palette  for this checkbox ('primary', 'accent', or 'warn'). */
  @Input() color: ThemePalette = 'accent';

  /** Whether the label should appear after or before the checkbox. Defaults to 'after'. */
  @Input() labelPosition: 'before'|'after' = 'after';

  /** The `name` attribute to use for the input element. */
  @Input() name: string|null = null;

  /** The `tabindex` attribute to use for the input element. */
  @Input() tabIndex: number;

  /** The `value` attribute to use for the input element */
  @Input() value: string;

  private _uniqueId = `mat-mdc-checkbox-${++nextUniqueId}`;

  /** A unique id for the checkbox. If none is supplied, it will be auto-generated. */
  @Input() id: string = this._uniqueId;

  /** Whether the checkbox is checked. */
  @Input()
  get checked(): boolean {
    return this._checked;
  }
  set checked(checked) {
    this._checked = coerceBooleanProperty(checked);
  }
  private _checked = false;

  /**
   * Whether the checkbox is indeterminate. This is also known as "mixed" mode and can be used to
   * represent a checkbox with three states, e.g. a checkbox that represents a nested list of
   * checkable items. Note that whenever checkbox is manually clicked, indeterminate is immediately
   * set to false.
   */
  @Input()
  get indeterminate(): boolean {
    return this._indeterminate;
  }
  set indeterminate(indeterminate) {
    this._indeterminate = coerceBooleanProperty(indeterminate);
  }
  private _indeterminate = false;

  /** Whether the checkbox is disabled. */
  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(disabled) {
    this._disabled = coerceBooleanProperty(disabled);
  }
  private _disabled = false;

  /** Whether the checkbox is required. */
  @Input()
  get required(): boolean {
    return this._required;
  }
  set required(required) {
    this._required = coerceBooleanProperty(required);
  }
  private _required = false;

  /** Whether to disable the ripple on this checkbox. */
  @Input()
  get disableRipple(): boolean {
    return this._disableRipple;
  }
  set disableRipple(disableRipple: boolean) {
    this._disableRipple = coerceBooleanProperty(disableRipple);
  }
  private _disableRipple = false;

  /** Event emitted when the checkbox's `checked` value changes. */
  @Output()
  readonly change: EventEmitter<MatCheckboxChange> = new EventEmitter<MatCheckboxChange>();

  /** Event emitted when the checkbox's `indeterminate` value changes. */
  @Output() readonly indeterminateChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  /** The root element for the `MDCCheckbox`. */
  @ViewChild('checkbox', {static: false}) _checkbox: ElementRef<HTMLElement>;

  /** The native input element. */
  @ViewChild('nativeCheckbox', {static: false}) _nativeCheckbox: ElementRef<HTMLInputElement>;

  /** The native label element. */
  @ViewChild('label', {static: false}) _label: ElementRef<HTMLElement>;

  /** Returns the unique id for the visual hidden input. */
  get inputId(): string {
    return `${this.id || this._uniqueId}-input`;
  }

  /** The `MDCCheckboxFoundation` instance for this checkbox. */
  _checkboxFoundation: MDCCheckboxFoundation;

  /** The set of classes that should be applied to the native input. */
  _classes: {[key: string]: boolean} = {'mdc-checkbox__native-control': true};

  /** Animation config for the ripple. */
  _rippleAnimation = {
    enterDuration: numbers.DEACTIVATION_TIMEOUT_MS,
    exitDuration: numbers.FG_DEACTIVATION_MS,
  };

  /** ControlValueAccessor onChange */
  private _cvaOnChange = (_: boolean) => {};

  /** ControlValueAccessor onTouch */
  private _cvaOnTouch = () => {};

  /**
   * A list of attributes that should not be modified by `MDCFoundation` classes.
   *
   * MDC uses animation events to determine when to update `aria-checked` which is unreliable.
   * Therefore we disable it and handle it ourselves.
   */
  private _attrBlacklist = new Set(['aria-checked']);

  /** The `MDCCheckboxAdapter` instance for this checkbox. */
  private _checkboxAdapter: MDCCheckboxAdapter = {
    addClass: (className) => this._setClass(className, true),
    removeClass: (className) => this._setClass(className, false),
    forceLayout: () => this._platform.isBrowser && this._checkbox.nativeElement.offsetWidth,
    hasNativeControl: () => !!this._nativeCheckbox,
    isAttachedToDOM: () => !!this._checkbox.nativeElement.parentNode,
    isChecked: () => this.checked,
    isIndeterminate: () => this.indeterminate,
    removeNativeControlAttr:
        (attr) => {
          if (!this._attrBlacklist.has(attr)) {
            this._nativeCheckbox.nativeElement.removeAttribute(attr);
          }
        },
    setNativeControlAttr:
        (attr, value) => {
          if (!this._attrBlacklist.has(attr)) {
            this._nativeCheckbox.nativeElement.setAttribute(attr, value);
          }
        },
    setNativeControlDisabled: (disabled) => this.disabled = disabled,
  };

  constructor(
      private _changeDetectorRef: ChangeDetectorRef,
      private _platform: Platform,
      @Attribute('tabindex') tabIndex: string,
      @Optional() @Inject(MAT_CHECKBOX_CLICK_ACTION) private _clickAction: MatCheckboxClickAction,
      @Optional() @Inject(ANIMATION_MODULE_TYPE) public _animationMode?: string) {
    this.tabIndex = parseInt(tabIndex) || 0;
    this._checkboxFoundation = new MDCCheckboxFoundation(this._checkboxAdapter);
    // Note: We don't need to set up the MDCFormFieldFoundation. Its only purpose is to manage the
    // ripple, which we do ourselves instead.
  }

  ngAfterViewInit() {
    this._checkboxFoundation.init();
  }

  ngOnDestroy() {
    this._checkboxFoundation.destroy();
  }

  /**
   * Implemented as part of `ControlValueAccessor`
   * @docs-private
   */
  registerOnChange(fn: (checked: boolean) => void) {
    this._cvaOnChange = fn;
  }

  /**
   * Implemented as part of `ControlValueAccessor`
   * @docs-private
   */
  registerOnTouched(fn: () => void) {
    this._cvaOnTouch = fn;
  }

  /**
   * Implemented as part of `ControlValueAccessor`
   * @docs-private
   */
  setDisabledState(isDisabled: boolean) {
    this.disabled = isDisabled;
    this._changeDetectorRef.markForCheck();
  }

  /**
   * Implemented as part of `ControlValueAccessor`
   * @docs-private
   */
  writeValue(value: any) {
    this.checked = !!value;
    this._changeDetectorRef.markForCheck();
  }

  /** Focuses the checkbox. */
  focus() {
    this._nativeCheckbox.nativeElement.focus();
  }

  /** Toggles the `checked` state of the checkbox. */
  toggle() {
    this.checked = !this.checked;
    this._cvaOnChange(this.checked);
  }

  /** Handles blur events on the native input. */
  _onBlur() {
    // When a focused element becomes disabled, the browser *immediately* fires a blur event.
    // Angular does not expect events to be raised during change detection, so any state change
    // (such as a form control's 'ng-touched') will cause a changed-after-checked error.
    // See https://github.com/angular/angular/issues/17793. To work around this, we defer
    // telling the form control it has been touched until the next tick.
    Promise.resolve().then(() => {
      this._cvaOnTouch();
      this._changeDetectorRef.markForCheck();
    });
  }

  /**
   * Handles click events on the native input.
   *
   * Note: we must listen to the `click` event rather than the `change` event because IE & Edge do
   * not actually change the checked state when the user clicks an indeterminate checkbox. By
   * listening to `click` instead we can override and normalize the behavior to change the checked
   * state like other browsers do.
   */
  _onClick() {
    if (this._clickAction === 'noop') {
      this._nativeCheckbox.nativeElement.checked = this.checked;
      this._nativeCheckbox.nativeElement.indeterminate = this.indeterminate;
      return;
    }

    if (this.indeterminate && this._clickAction !== 'check') {
      this.indeterminate = false;
      // tslint:disable:max-line-length
      // We use `Promise.resolve().then` to ensure the same timing as the original `MatCheckbox`:
      // https://github.com/angular/components/blob/309d5644aa610ee083c56a823ce7c422988730e8/src/lib/checkbox/checkbox.ts#L381
      // tslint:enable:max-line-length
      Promise.resolve().then(() => this.indeterminateChange.next(this.indeterminate));
    } else {
      this._nativeCheckbox.nativeElement.indeterminate = this.indeterminate;
    }

    this.checked = !this.checked;
    this._checkboxFoundation.handleChange();

    // Dispatch our change event
    const newEvent = new MatCheckboxChange();
    newEvent.source = this as any;
    newEvent.checked = this.checked;
    this._cvaOnChange(this.checked);
    this.change.next(newEvent);
  }

  /** Gets the value for the `aria-checked` attribute of the native input. */
  _getAriaChecked(): 'true'|'false'|'mixed' {
    return this.checked ? 'true' : (this.indeterminate ? 'mixed' : 'false');
  }

  /** Sets whether the given CSS class should be applied to the native input. */
  private _setClass(cssClass: string, active: boolean) {
    this._classes[cssClass] = active;
    this._changeDetectorRef.markForCheck();
  }
}
