// @flow
import { Trans, t } from '@lingui/macro';
import { I18n } from '@lingui/react';
import { type I18n as I18nType } from '@lingui/core';

import * as React from 'react';
import Checkbox from '../../UI/Checkbox';
import ResourceSelectorWithThumbnail from '../../ResourcesList/ResourceSelectorWithThumbnail';
import { type EditorProps } from './EditorProps.flow';
import SemiControlledTextField from '../../UI/SemiControlledTextField';
import {
  ResponsiveLineStackLayout,
  ColumnStackLayout,
  LineStackLayout,
} from '../../UI/Layout';
import { Column } from '../../UI/Grid';
import Text from '../../UI/Text';
import SelectField from '../../UI/SelectField';
import SelectOption from '../../UI/SelectOption';
import ResponsiveFlatButton from '../../UI/ResponsiveFlatButton';
import Copy from '../../UI/CustomSvgIcons/Copy';
import Trash from '../../UI/CustomSvgIcons/Trash';
import Edit from '../../UI/CustomSvgIcons/Edit';
import useForceUpdate from '../../Utils/UseForceUpdate';
import useAlertDialog from '../../UI/Alert/useAlertDialog';
import newNameGenerator from '../../Utils/NewNameGenerator';
import NewVariantDialog from './CustomObjectPropertiesEditor/NewVariantDialog';
import Dialog, { DialogPrimaryButton } from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';

const gd: libGDevelop = global.gd;

const VARIANTS_VARIABLE_NAME = '__panelSpriteVariants__';
const SELECTED_VARIANT_VARIABLE_NAME = '__panelSpriteSelectedVariant__';
const DEFAULT_VARIANT_NAME = 'Default';

type VariantData = {|
  texture: string,
|};

const getVariantsFromObject = (
  object: gdObject | void
): { [string]: VariantData } => {
  if (!object) return {};

  const variables = object.getVariables();
  if (!variables.has(VARIANTS_VARIABLE_NAME)) {
    return {};
  }

  const variantsVariable = variables.get(VARIANTS_VARIABLE_NAME);
  const variants: { [string]: VariantData } = {};

  const childrenNames = variantsVariable.getAllChildrenNames();
  for (let i = 0; i < childrenNames.size(); i++) {
    const variantName = childrenNames.at(i);
    const variantVariable = variantsVariable.getChild(variantName);
    variants[variantName] = {
      texture: variantVariable.hasChild('texture')
        ? variantVariable.getChild('texture').getString()
        : '',
    };
  }

  return variants;
};

const setVariantTexture = (
  object: gdObject | void,
  variantName: string,
  texture: string
): void => {
  if (!object) return;

  const variables = object.getVariables();
  if (!variables.has(VARIANTS_VARIABLE_NAME)) {
    variables.insertNew(VARIANTS_VARIABLE_NAME, 0);
  }

  const variantsVariable = variables.get(VARIANTS_VARIABLE_NAME);
  const variantVariable = variantsVariable.getChild(variantName);
  variantVariable.getChild('texture').setString(texture);
};

const deleteVariantFromObject = (
  object: gdObject | void,
  variantName: string
): void => {
  if (!object) return;

  const variables = object.getVariables();
  if (!variables.has(VARIANTS_VARIABLE_NAME)) {
    return;
  }

  const variantsVariable = variables.get(VARIANTS_VARIABLE_NAME);
  if (variantsVariable.hasChild(variantName)) {
    variantsVariable.removeChild(variantName);
  }
};

const getSelectedVariantName = (object: gdObject | void): string => {
  if (!object) return '';

  const variables = object.getVariables();
  if (!variables.has(SELECTED_VARIANT_VARIABLE_NAME)) {
    return '';
  }

  return variables.get(SELECTED_VARIANT_VARIABLE_NAME).getString();
};

const setSelectedVariantName = (
  object: gdObject | void,
  variantName: string
): void => {
  if (!object) return;

  const variables = object.getVariables();
  if (!variables.has(SELECTED_VARIANT_VARIABLE_NAME)) {
    variables.insertNew(SELECTED_VARIANT_VARIABLE_NAME, 0);
  }

  variables.get(SELECTED_VARIANT_VARIABLE_NAME).setString(variantName);
};

const getAllVariantNames = (object: gdObject | void): string[] => {
  const variants = getVariantsFromObject(object);
  return Object.keys(variants);
};

const ensureDefaultVariantExists = (
  object: gdObject | void,
  currentTexture: string
): void => {
  if (!object) return;

  const variants = getVariantsFromObject(object);
  const variantNames = Object.keys(variants);
  // Only create Default if no variants exist at all
  if (variantNames.length === 0) {
    setVariantTexture(object, DEFAULT_VARIANT_NAME, currentTexture);
    setSelectedVariantName(object, DEFAULT_VARIANT_NAME);
  }
};

const getTextureForVariant = (
  object: gdObject | void,
  variantName: string,
  fallbackTexture: string
): string => {
  const variants = getVariantsFromObject(object);
  return variants[variantName]?.texture || fallbackTexture;
};

const renameVariant = (
  object: gdObject | void,
  oldName: string,
  newName: string
): boolean => {
  if (!object) return false;
  if (oldName === newName) return true;
  if (!oldName || !newName) return false;

  const variables = object.getVariables();
  if (!variables.has(VARIANTS_VARIABLE_NAME)) {
    return false;
  }

  const variantsVariable = variables.get(VARIANTS_VARIABLE_NAME);

  // Check if old variant exists
  if (!variantsVariable.hasChild(oldName)) {
    return false;
  }

  // Check if new name already exists
  if (variantsVariable.hasChild(newName)) {
    return false;
  }

  // Get the old variant data
  const oldVariant = variantsVariable.getChild(oldName);
  const texture = oldVariant.hasChild('texture')
    ? oldVariant.getChild('texture').getString()
    : '';

  // Create the new variant with the same texture
  const newVariant = variantsVariable.getChild(newName);
  newVariant.getChild('texture').setString(texture);

  // Remove the old variant
  variantsVariable.removeChild(oldName);

  return true;
};

const PanelSpriteEditor = (props: EditorProps) => {
  const {
    objectConfiguration,
    project,
    resourceManagementProps,
    projectScopedContainersAccessor,
    objectName,
    renderObjectNameField,
    object,
    onObjectUpdated,
  } = props;

  const forceUpdate = useForceUpdate();
  const { showDeleteConfirmation } = useAlertDialog();

  const [newVariantDialogOpen, setNewVariantDialogOpen] = React.useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState('');

  const panelSpriteConfiguration = gd.asPanelSpriteConfiguration(
    objectConfiguration
  );

  const variantNames = getAllVariantNames(object);

  // Initialize: ensure at least one variant exists
  React.useEffect(() => {
    if (variantNames.length === 0) {
      const currentTexture = panelSpriteConfiguration.getTexture();
      ensureDefaultVariantExists(object, currentTexture);
    }
  }, [object, panelSpriteConfiguration, variantNames.length]);

  const storedSelectedVariant = getSelectedVariantName(object);

  // Validate that stored variant still exists, fallback to first variant
  const selectedVariant = React.useMemo(() => {
    if (storedSelectedVariant && variantNames.includes(storedSelectedVariant)) {
      return storedSelectedVariant;
    }
    // Fallback to first variant if stored one doesn't exist
    return variantNames.length > 0 ? variantNames[0] : '';
  }, [storedSelectedVariant, variantNames]);

  const currentTexture = panelSpriteConfiguration.getTexture();

  const handleTextureChange = React.useCallback(
    (resourceName: string) => {
      // Update the main texture (displayed on stage)
      panelSpriteConfiguration.setTexture(resourceName);

      // Also store in variant data
      if (selectedVariant) {
        setVariantTexture(object, selectedVariant, resourceName);
      }

      if (onObjectUpdated) {
        onObjectUpdated();
      }
      forceUpdate();
    },
    [
      selectedVariant,
      object,
      panelSpriteConfiguration,
      onObjectUpdated,
      forceUpdate,
    ]
  );

  const handleVariantChange = React.useCallback(
    (newVariant: string) => {
      if (!newVariant) return;

      // Save current texture to current variant before switching
      if (selectedVariant) {
        const currentTexture = panelSpriteConfiguration.getTexture();
        setVariantTexture(object, selectedVariant, currentTexture);
      }

      // Switch to new variant
      setSelectedVariantName(object, newVariant);

      // Load texture from new variant
      const newTexture = getTextureForVariant(
        object,
        newVariant,
        panelSpriteConfiguration.getTexture()
      );
      panelSpriteConfiguration.setTexture(newTexture);

      if (onObjectUpdated) {
        onObjectUpdated();
      }
      forceUpdate();
    },
    [selectedVariant, object, panelSpriteConfiguration, onObjectUpdated, forceUpdate]
  );

  const handleDuplicateVariant = React.useCallback(
    (i18n: I18nType, newName: string) => {
      const uniqueNewName = newNameGenerator(
        newName || i18n._(t`New variant`),
        tentativeNewName => variantNames.includes(tentativeNewName)
      );

      // Get current texture to use for the new variant
      const sourceTexture = panelSpriteConfiguration.getTexture();
      setVariantTexture(object, uniqueNewName, sourceTexture);

      // Switch to the new variant
      setSelectedVariantName(object, uniqueNewName);

      setNewVariantDialogOpen(false);
      if (onObjectUpdated) {
        onObjectUpdated();
      }
      forceUpdate();
    },
    [
      object,
      panelSpriteConfiguration,
      variantNames,
      onObjectUpdated,
      forceUpdate,
    ]
  );

  const handleDeleteVariant = React.useCallback(
    async () => {
      // Don't allow deleting the last variant
      if (!selectedVariant || variantNames.length <= 1) return;

      const hasConfirmedDeletion = await showDeleteConfirmation({
        title: t`Remove variant`,
        message: t`Are you sure you want to remove this variant? This can't be undone.`,
      });
      if (!hasConfirmedDeletion) {
        return;
      }

      // Delete the variant
      deleteVariantFromObject(object, selectedVariant);

      // Switch to first remaining variant
      const remainingVariants = variantNames.filter(v => v !== selectedVariant);
      const newSelectedVariant =
        remainingVariants.length > 0 ? remainingVariants[0] : '';

      if (newSelectedVariant) {
        setSelectedVariantName(object, newSelectedVariant);
        const newTexture = getTextureForVariant(
          object,
          newSelectedVariant,
          panelSpriteConfiguration.getTexture()
        );
        panelSpriteConfiguration.setTexture(newTexture);
      }

      if (onObjectUpdated) {
        onObjectUpdated();
      }
      forceUpdate();
    },
    [
      object,
      selectedVariant,
      variantNames,
      showDeleteConfirmation,
      panelSpriteConfiguration,
      onObjectUpdated,
      forceUpdate,
    ]
  );

  const handleOpenRenameDialog = React.useCallback(() => {
    setRenameValue(selectedVariant);
    setRenameDialogOpen(true);
  }, [selectedVariant]);

  const handleRenameVariant = React.useCallback(() => {
    const oldName = selectedVariant;
    const newName = renameValue.trim();

    if (!newName || !oldName) {
      setRenameDialogOpen(false);
      return;
    }

    // Check if new name already exists
    if (newName !== oldName && variantNames.includes(newName)) {
      setRenameDialogOpen(false);
      return;
    }

    // Perform the rename
    const success = renameVariant(object, oldName, newName);
    if (success) {
      // Update the selected variant
      setSelectedVariantName(object, newName);

      if (onObjectUpdated) {
        onObjectUpdated();
      }
    }

    setRenameDialogOpen(false);
    forceUpdate();
  }, [object, selectedVariant, renameValue, variantNames, onObjectUpdated, forceUpdate]);

  return (
    <I18n>
      {({ i18n }) => (
        <>
          <ColumnStackLayout noMargin>
            {renderObjectNameField && renderObjectNameField()}

            <LineStackLayout
              noMargin
              justifyContent="space-between"
              alignItems="center"
            >
              <Text size="block-title">
                <Trans>Variant</Trans>
              </Text>
              <Column>
                <LineStackLayout>
                  <ResponsiveFlatButton
                    key={'delete-variant'}
                    label={<Trans>Delete</Trans>}
                    leftIcon={<Trash />}
                    onClick={handleDeleteVariant}
                    disabled={variantNames.length <= 1}
                  />
                  <ResponsiveFlatButton
                    key={'duplicate-variant'}
                    label={<Trans>Duplicate</Trans>}
                    leftIcon={<Copy />}
                    onClick={() => setNewVariantDialogOpen(true)}
                  />
                  <ResponsiveFlatButton
                    key={'edit-variant'}
                    label={<Trans>Edit</Trans>}
                    leftIcon={<Edit />}
                    onClick={handleOpenRenameDialog}
                  />
                </LineStackLayout>
              </Column>
            </LineStackLayout>

            <ColumnStackLayout expand noMargin>
              <SelectField
                id={'variant-name'}
                floatingLabelText={<Trans>Variant</Trans>}
                value={selectedVariant}
                onChange={(e, i, value: string) => {
                  handleVariantChange(value);
                }}
              >
                {variantNames.map(variantName => (
                  <SelectOption
                    key={'variant-' + variantName}
                    value={variantName}
                    label={variantName}
                  />
                ))}
              </SelectField>
            </ColumnStackLayout>

            <ResourceSelectorWithThumbnail
              project={project}
              resourceManagementProps={resourceManagementProps}
              projectScopedContainersAccessor={projectScopedContainersAccessor}
              resourceKind="image"
              resourceName={currentTexture}
              defaultNewResourceName={objectName}
              onChange={handleTextureChange}
              floatingLabelText={<Trans>Select an image</Trans>}
            />
            <Checkbox
              label={
                <Trans>
                  Repeat borders and center textures (instead of stretching
                  them)
                </Trans>
              }
              checked={panelSpriteConfiguration.isTiled()}
              onCheck={(e, checked) => {
                panelSpriteConfiguration.setTiled(checked);
                forceUpdate();
              }}
            />
            <ResponsiveLineStackLayout noResponsiveLandscape noMargin>
              <SemiControlledTextField
                commitOnBlur
                floatingLabelText={<Trans>Top margin</Trans>}
                fullWidth
                type="number"
                value={panelSpriteConfiguration.getTopMargin()}
                onChange={value => {
                  panelSpriteConfiguration.setTopMargin(
                    parseInt(value, 10) || 0
                  );
                  forceUpdate();
                }}
              />
              <SemiControlledTextField
                commitOnBlur
                floatingLabelText={<Trans>Bottom margin</Trans>}
                fullWidth
                type="number"
                value={panelSpriteConfiguration.getBottomMargin()}
                onChange={value => {
                  panelSpriteConfiguration.setBottomMargin(
                    parseInt(value, 10) || 0
                  );
                  forceUpdate();
                }}
              />
            </ResponsiveLineStackLayout>
            <ResponsiveLineStackLayout noResponsiveLandscape noMargin>
              <SemiControlledTextField
                commitOnBlur
                floatingLabelText={<Trans>Left margin</Trans>}
                fullWidth
                type="number"
                value={panelSpriteConfiguration.getLeftMargin()}
                onChange={value => {
                  panelSpriteConfiguration.setLeftMargin(
                    parseInt(value, 10) || 0
                  );
                  forceUpdate();
                }}
              />
              <SemiControlledTextField
                commitOnBlur
                floatingLabelText={<Trans>Right margin</Trans>}
                fullWidth
                type="number"
                value={panelSpriteConfiguration.getRightMargin()}
                onChange={value => {
                  panelSpriteConfiguration.setRightMargin(
                    parseInt(value, 10) || 0
                  );
                  forceUpdate();
                }}
              />
            </ResponsiveLineStackLayout>
            <ResponsiveLineStackLayout noResponsiveLandscape noMargin>
              <SemiControlledTextField
                commitOnBlur
                floatingLabelText={<Trans>Default width (in pixels)</Trans>}
                fullWidth
                type="number"
                value={panelSpriteConfiguration.getWidth()}
                onChange={value => {
                  panelSpriteConfiguration.setWidth(parseInt(value, 10) || 0);
                  forceUpdate();
                }}
              />
              <SemiControlledTextField
                commitOnBlur
                floatingLabelText={<Trans>Default height (in pixels)</Trans>}
                fullWidth
                type="number"
                value={panelSpriteConfiguration.getHeight()}
                onChange={value => {
                  panelSpriteConfiguration.setHeight(parseInt(value, 10) || 0);
                  forceUpdate();
                }}
              />
            </ResponsiveLineStackLayout>
          </ColumnStackLayout>

          {newVariantDialogOpen && (
            <NewVariantDialog
              initialName={selectedVariant || i18n._(t`New variant`)}
              onApply={name => handleDuplicateVariant(i18n, name)}
              onCancel={() => {
                setNewVariantDialogOpen(false);
              }}
            />
          )}

          {renameDialogOpen && (
            <Dialog
              title={<Trans>Rename variant</Trans>}
              id="rename-variant-dialog"
              actions={[
                <FlatButton
                  key="cancel"
                  label={<Trans>Cancel</Trans>}
                  onClick={() => setRenameDialogOpen(false)}
                />,
                <DialogPrimaryButton
                  key="apply"
                  label={<Trans>Rename</Trans>}
                  primary
                  onClick={handleRenameVariant}
                />,
              ]}
              onRequestClose={() => setRenameDialogOpen(false)}
              onApply={handleRenameVariant}
              open
              maxWidth="sm"
            >
              <ColumnStackLayout noMargin>
                <SemiControlledTextField
                  fullWidth
                  id="rename-variant-name"
                  commitOnBlur
                  floatingLabelText={<Trans>Variant name</Trans>}
                  floatingLabelFixed
                  value={renameValue}
                  translatableHintText={t`Variant name`}
                  onChange={setRenameValue}
                  autoFocus="desktop"
                />
              </ColumnStackLayout>
            </Dialog>
          )}
        </>
      )}
    </I18n>
  );
};

export default PanelSpriteEditor;
