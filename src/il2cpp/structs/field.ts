import { cache } from "decorator-cache-getter";
import { raise } from "../../utils/console";
import { NonNullNativeStruct } from "../../utils/native-struct";
import { read, write } from "../utils";

/** Represents a `FieldInfo`. */
class Il2CppField<T extends Il2Cpp.Field.Type> extends NonNullNativeStruct {
    /** Gets the class in which this field is defined. */
    @cache
    get class(): Il2Cpp.Class {
        return new Il2Cpp.Class(Il2Cpp.Api._fieldGetClass(this));
    }

    /** Gets the flags of the current field. */
    @cache
    get flags(): number {
        return Il2Cpp.Api._fieldGetFlags(this);
    }

    /** Determines whether this field value is known at compile time. */
    @cache
    get isLiteral(): boolean {
        return !!Il2Cpp.Api._fieldIsLiteral(this);
    }

    /** Determines whether this field is static. */
    @cache
    get isStatic(): boolean {
        return !!Il2Cpp.Api._fieldIsStatic(this);
    }

    /** Determines whether this field is thread static. */
    @cache
    get isThreadStatic(): boolean {
        return !!Il2Cpp.Api._fieldIsThreadStatic(this);
    }

    /** Gets the access modifier of this field. */
    get modifier(): string {
        return Il2Cpp.Api._fieldGetModifier(this).readUtf8String()!;
    }

    /** Gets the name of this field. */
    @cache
    get name(): string {
        return Il2Cpp.Api._fieldGetName(this).readUtf8String()!;
    }

    /** Gets the offset of this field, calculated as the difference with its owner virtual address. */
    @cache
    get offset(): number {
        return Il2Cpp.Api._fieldGetOffset(this);
    }

    /** Gets the type of this field. */
    @cache
    get type(): Il2Cpp.Type {
        return new Il2Cpp.Type(Il2Cpp.Api._fieldGetType(this));
    }

    /** Gets the value of this field. */
    get value(): T {
        const handle = Memory.alloc(Process.pointerSize);
        Il2Cpp.Api._fieldGetStaticValue(this.handle, handle);

        return read(handle, this.type) as T;
    }

    /** Sets the value of this field. Thread static or literal values cannot be altered yet. */
    set value(value: T) {
        if (this.isThreadStatic || this.isLiteral) {
            raise(`cannot modify the value of field ${this.name}: is thread static or literal`);
        }

        const handle = Memory.alloc(Process.pointerSize);
        write(handle, value, this.type);

        Il2Cpp.Api._fieldSetStaticValue(this.handle, handle);
    }

    /** */
    toString(): string {
        return `\
${this.isThreadStatic ? `[ThreadStatic] ` : ``}\
${this.isStatic ? `static ` : ``}\
${this.type.name} \
${this.name}\
${this.isLiteral ? ` = ${this.type.class.isEnum ? read((this.value as Il2Cpp.ValueType).handle, this.type.class.baseType!) : this.value}` : ``};\
${this.isThreadStatic || this.isLiteral ? `` : ` // 0x${this.offset.toString(16)}`}`;
    }

    /** @internal */
    withHolder(instance: Il2Cpp.Object | Il2Cpp.ValueType): Il2Cpp.Field<T> {
        let valueHandle = instance.handle.add(this.offset);
        if (instance instanceof Il2Cpp.ValueType) {
            valueHandle = valueHandle.sub(Il2Cpp.Runtime.objectHeaderSize);
        }

        return new Proxy(this, {
            get(target: Il2Cpp.Field<T>, property: keyof Il2Cpp.Field): any {
                if (property == "value") {
                    return read(valueHandle, target.type);
                }
                return Reflect.get(target, property);
            },

            set(target: Il2Cpp.Field<T>, property: keyof Il2Cpp.Field, value: any): boolean {
                if (property == "value") {
                    write(valueHandle, value, target.type);
                    return true;
                }

                return Reflect.set(target, property, value);
            }
        });
    }
}

Reflect.set(Il2Cpp, "Field", Il2CppField);

declare global {
    namespace Il2Cpp {
        class Field<T extends Il2Cpp.Field.Type = Il2Cpp.Field.Type> extends Il2CppField<T> {}

        namespace Field {
            type Type =
                | boolean
                | number
                | Int64
                | UInt64
                | NativePointer
                | Il2Cpp.Pointer
                | Il2Cpp.ValueType
                | Il2Cpp.Object
                | Il2Cpp.String
                | Il2Cpp.Array;

            const enum Attributes {
                FieldAccessMask = 0x0007,
                PrivateScope = 0x0000,
                Private = 0x0001,
                FamilyAndAssembly = 0x0002,
                Assembly = 0x0003,
                Family = 0x0004,
                FamilyOrAssembly = 0x0005,
                Public = 0x0006,
                Static = 0x0010,
                InitOnly = 0x0020,
                Literal = 0x0040,
                NotSerialized = 0x0080,
                SpecialName = 0x0200,
                PinvokeImpl = 0x2000,
                ReservedMask = 0x9500,
                RTSpecialName = 0x0400,
                HasFieldMarshal = 0x1000,
                HasDefault = 0x8000,
                HasFieldRVA = 0x0100
            }
        }
    }
}
